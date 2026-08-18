import { prisma } from "../../lib/db";
import { Prisma, type PaymentStatus as PaymentStatusDb } from "../../generated/prisma/client";
import { ordersRepository } from "../orders/repository";
import { ordersService } from "../orders/service";
import { vendorsRepository } from "../vendors/repository";
import { administrationRepository } from "../administration/repository";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { mockPaymentProvider } from "./mockProvider";
import { moolrePaymentProvider } from "./providers/moolre/adapter";
import { paystackPaymentProvider, initiatePaystackCardPayment } from "./providers/paystack/adapter";
import { getActivePaymentProvider } from "./router";
import { resolutionsService } from "../resolutions/service";
import type { InitiatePaymentOutcome, PaymentProvider, VerifyPaymentOutcome } from "./provider";
import { generatePaymentReference } from "../../lib/payment-number";
import { normalizeGhanaPhone, maskGhanaPhone } from "../../lib/phone";
import { ok, err, type Result } from "../../lib/result";
import { env } from "../../lib/env";
import type { MockPaymentOutcome, MobileMoneyNetworkCode, PaymentStatusView } from "./types";

/** Safe, secret-free structured logging for the payment lifecycle (CLAUDE.md §22). */
function logPaymentEvent(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ scope: "payment", event, ...data, ts: new Date().toISOString() }));
}

/**
 * Admin reconciliation must use the provider THAT PAYMENT actually used —
 * never the currently-active default. A customer may have paid weeks ago
 * via a provider CrownSourceGlobal has since stopped routing new payments
 * to (Moolre, deferred as of M10A.2); that Payment's history must remain
 * reconcilable regardless of what env.PAYMENT_PROVIDER says today.
 */
function providerForName(name: "MOOLRE" | "PAYSTACK"): PaymentProvider {
  return name === "MOOLRE" ? moolrePaymentProvider : paystackPaymentProvider;
}

/**
 * Raw "awaiting OTP" provider status codes — the one place provider
 * vocabulary is unavoidably visible in the shared service layer, since
 * there's no dedicated schema column for "awaiting OTP" (a display/UX
 * gating concern, not a financial one). Moolre's TP14 and Paystack's
 * send_otp both map to the shared OTP_REQUIRED outcome already; this list
 * only needs a new entry if a future provider introduces a third code.
 */
const OTP_REQUIRED_PROVIDER_CODES = ["TP14", "send_otp"];

/**
 * Post-commit notification boundary: fires only after confirmOrderPayment's
 * own transaction has already committed, and only for vendors that
 * genuinely received a NEW Fulfilment this call — never on an idempotent
 * re-confirmation (protects both payment idempotency and against duplicate
 * "new order" notifications).
 */
async function notifyVendorsOfNewOrder(
  fulfilments: { vendorId: string; fulfilmentId: string }[],
  orderNumber: string,
): Promise<void> {
  for (const { vendorId, fulfilmentId } of fulfilments) {
    const owner = await vendorsRepository.findOwnerUserIdAndEmail(vendorId);
    if (!owner) continue;
    await notificationsService.notify({
      recipientUserId: owner.userId,
      type: "VENDOR_NEW_ORDER",
      title: "New order to prepare",
      body: `You have a new order to prepare: ${orderNumber}.`,
      targetUrl: notificationLinks.vendorOrder(fulfilmentId),
      eventKey: `vendor-new-order:${fulfilmentId}`,
      email: {
        to: owner.email,
        subject: "You have a new order to prepare",
        templateKey: "vendor-new-order",
        templateData: { orderNumber, fulfilmentId },
      },
    });
  }
}

async function resultForExistingKey(key: string): Promise<Result<{ succeeded: boolean }> | null> {
  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (!existing) {
    return null;
  }
  const payment = await prisma.payment.findUnique({ where: { id: existing.resultRef } });
  if (!payment) {
    return null;
  }
  return ok({ succeeded: payment.status === "SUCCEEDED" });
}

/**
 * Dispatches the same customer/vendor notifications regardless of which
 * provider confirmed the order — this is the one place both the mock flow
 * and the Moolre flow converge, on top of the SAME
 * `ordersService.confirmOrderPayment` transition (M10A's central
 * architectural requirement: no Moolre-specific order-confirmation path).
 */
async function dispatchOrderConfirmedNotifications(
  orderId: string,
  orderNumber: string,
  customerEmail: string,
  newFulfilments: { vendorId: string; fulfilmentId: string }[],
  customerUserId: string | null,
): Promise<void> {
  if (customerUserId) {
    await notificationsService.notify({
      recipientUserId: customerUserId,
      type: "ORDER_CONFIRMED",
      title: "Order confirmed",
      body: `Your CrownSourceGlobal order ${orderNumber} is confirmed and vendors have been notified.`,
      targetUrl: notificationLinks.customerOrder(orderId),
      eventKey: `order-confirmed:${orderId}`,
      email: {
        to: customerEmail,
        subject: "Your order is confirmed",
        templateKey: "order-confirmed",
        templateData: { orderNumber, orderId },
      },
    });
  }
  if (newFulfilments.length > 0) {
    void notifyVendorsOfNewOrder(newFulfilments, orderNumber);
  }
}

function toStatusView(payment: {
  id: string;
  status: string;
  method: string;
  providerStatus: string | null;
  network: string | null;
  phoneMasked: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  amount: Prisma.Decimal;
  currency: string;
  reference: string;
  failureReasonSafe: string | null;
}): PaymentStatusView {
  return {
    paymentId: payment.id,
    status: payment.status as PaymentStatusView["status"],
    method: payment.method as PaymentStatusView["method"],
    requiresOtp: OTP_REQUIRED_PROVIDER_CODES.includes(payment.providerStatus ?? ""),
    network: (payment.network as MobileMoneyNetworkCode | null) ?? null,
    phoneMasked: payment.phoneMasked,
    cardDisplay: payment.cardBrand && payment.cardLast4 ? { brand: payment.cardBrand, last4: payment.cardLast4 } : null,
    amount: payment.amount.toNumber(),
    currency: payment.currency,
    reference: payment.reference,
    failureReasonSafe: payment.failureReasonSafe,
    providerStatus: payment.providerStatus,
  };
}

/**
 * The single funnel every Moolre outcome (poll, webhook, admin
 * reconciliation) passes through before ever touching Order state. Fully
 * idempotent: a Payment already in a terminal status is a no-op, and the
 * SUCCEEDED transition itself is a guarded `updateMany` so concurrent
 * duplicate callers can only ever have exactly one winner.
 */
async function applyVerifyOutcome(paymentId: string, verified: VerifyPaymentOutcome): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  if (payment.status === "SUCCEEDED" || payment.status === "FAILED" || payment.status === "CANCELLED") {
    return; // terminal — duplicate callback/poll/reconciliation, nothing to do
  }

  if (verified.status === "PENDING") {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { lastVerifiedAt: new Date(), providerStatus: verified.providerStatus },
    });
    return;
  }
  if (verified.status === "UNKNOWN") {
    await prisma.payment.update({ where: { id: paymentId }, data: { lastVerifiedAt: new Date() } });
    return;
  }

  if (verified.status === "FAILED") {
    const claim = await prisma.payment.updateMany({
      where: { id: paymentId, status: { in: ["INITIATED", "PENDING"] } },
      data: { status: "FAILED", failureReasonSafe: verified.reasonSafe, providerStatus: verified.providerStatus, lastVerifiedAt: new Date() },
    });
    if (claim.count === 1) {
      logPaymentEvent("payment_failed", { paymentId });
      const order = await prisma.order.findUnique({
        where: { id: payment.orderId },
        select: { orderNumber: true, customerProfile: { select: { userId: true, user: { select: { email: true } } } } },
      });
      if (order?.customerProfile.userId) {
        await notificationsService.notify({
          recipientUserId: order.customerProfile.userId,
          type: "PAYMENT_FAILED",
          title: "Payment could not be completed",
          body: `We couldn't complete your payment for order ${order.orderNumber}. You can try again.`,
          targetUrl: notificationLinks.customerOrder(payment.orderId),
          eventKey: `payment-failed:${paymentId}`,
          email: {
            to: order.customerProfile.user.email,
            subject: "Your payment could not be completed",
            templateKey: "payment-failed",
            templateData: { orderNumber: order.orderNumber, orderId: payment.orderId },
          },
        });
      }
    }
    return;
  }

  // verified.status === "SUCCEEDED"
  const amountMatches = Math.abs(verified.verifiedAmount - payment.amount.toNumber()) < 0.005;
  const currencyMatches = verified.verifiedCurrency === payment.currency;
  if (!amountMatches || !currencyMatches) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        lastVerifiedAt: new Date(),
        providerStatus: verified.providerStatus,
        exceptionReason: `Amount/currency mismatch: expected ${payment.amount.toFixed(2)} ${payment.currency}, provider reported ${verified.verifiedAmount} ${verified.verifiedCurrency}.`,
      },
    });
    logPaymentEvent("payment_amount_mismatch_quarantined", { paymentId });
    await raiseAdminPaymentException(payment.orderId, paymentId, payment.reference, "Amount/currency mismatch on verification");
    return; // never confirm on a mismatch
  }

  let claim: { count: number };
  try {
    claim = await prisma.payment.updateMany({
      where: { id: paymentId, status: { in: ["INITIATED", "PENDING"] } },
      data: {
        status: "SUCCEEDED",
        confirmedAt: new Date(),
        providerReference: verified.providerReference,
        providerStatus: verified.providerStatus,
        lastVerifiedAt: new Date(),
        cardBrand: verified.cardDisplay?.brand,
        cardLast4: verified.cardDisplay?.last4,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;

    // Unlike the initiate-path collision (a known non-identifying
    // placeholder, safe to drop), a collision HERE means the provider's own
    // status-verification endpoint returned a transaction id already
    // attached to a different Payment — a genuine integrity anomaly per
    // the brief's own instruction: never let two Payments independently
    // confirm two Orders off the same provider transaction. Fail closed:
    // do NOT confirm this Order, do NOT overwrite the other Payment's
    // claim, flag for manual review instead.
    const conflicting = await prisma.payment.findUnique({
      where: { providerReference: verified.providerReference },
      select: { id: true, reference: true, orderId: true },
    });
    logPaymentEvent("provider_reference_collision_on_verify", {
      paymentId,
      proposedProviderReference: verified.providerReference,
      conflictingPaymentId: conflicting?.id ?? null,
      conflictingReference: conflicting?.reference ?? null,
      conflictingOrderId: conflicting?.orderId ?? null,
    });
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        lastVerifiedAt: new Date(),
        providerStatus: verified.providerStatus,
        exceptionReason: `Provider transaction "${verified.providerReference}" is already attached to a different Payment (${conflicting?.reference ?? "unknown"}). Never auto-confirmed — requires manual review before this Order can proceed.`,
      },
    });
    await raiseAdminPaymentException(payment.orderId, paymentId, payment.reference, "Duplicate provider transaction id detected on verification — Order NOT confirmed");
    return;
  }
  if (claim.count !== 1) return; // lost the race — another caller already processed this success

  logPaymentEvent("payment_succeeded", { paymentId });

  const order = await prisma.order.findUnique({
    where: { id: payment.orderId },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      customerProfile: { select: { userId: true, user: { select: { email: true } } } },
    },
  });
  if (!order) return;

  if (order.status === "CANCELLED") {
    // Reservation was already released (abandoned-payment sweep) before this
    // late success arrived. Never silently reopen a terminal Order — surface
    // a CRITICAL exception for manual resolution instead.
    await prisma.payment.update({
      where: { id: paymentId },
      data: { exceptionReason: "Payment succeeded after this order was already cancelled and its inventory reservation released. Manual resolution required." },
    });
    logPaymentEvent("payment_succeeded_after_order_cancelled", { paymentId, orderId: order.id });
    await raiseAdminPaymentException(order.id, paymentId, payment.reference, "Payment succeeded after order cancellation");
    return;
  }

  if (order.status === "CONFIRMED") return; // already confirmed via another path — idempotent no-op

  const { newFulfilments, customerUserId } = await ordersService.confirmOrderPayment(payment.orderId);
  await dispatchOrderConfirmedNotifications(
    payment.orderId,
    order.orderNumber,
    order.customerProfile.user.email,
    newFulfilments,
    customerUserId,
  );
}

async function raiseAdminPaymentException(orderId: string, paymentId: string, reference: string, reason: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
  const admins = await administrationRepository.listAllForNotification();
  for (const admin of admins) {
    await notificationsService.notify({
      recipientUserId: admin.userId,
      type: "ADMIN_PAYMENT_REQUIRES_ATTENTION",
      title: "Payment requires attention",
      body: `${reason} — payment ${reference} on order ${order?.orderNumber ?? orderId}.`,
      targetUrl: notificationLinks.adminPayment(paymentId),
      eventKey: `payment-exception:${paymentId}`,
      email: {
        to: admin.user.email,
        subject: "Payment requires attention",
        templateKey: "admin-payment-requires-attention",
        templateData: { reference, orderNumber: order?.orderNumber ?? orderId, paymentId },
      },
    });
  }
}

export const paymentsService = {
  /**
   * Protects against double-clicking Pay / a retried submission: the
   * `idempotencyKey` is generated once per payment-page render (a hidden
   * form field), so a duplicate submission carries the same key and
   * returns the already-recorded outcome instead of creating a second
   * Payment or confirming the order twice.
   */
  async attemptMockPayment(params: {
    customerProfileId: string;
    orderId: string;
    outcome: MockPaymentOutcome;
    idempotencyKey: string;
  }): Promise<Result<{ succeeded: boolean }>> {
    const { customerProfileId, orderId, outcome, idempotencyKey } = params;

    const existingResult = await resultForExistingKey(idempotencyKey);
    if (existingResult) {
      return existingResult;
    }

    const order = await ordersRepository.findOwnershipAndStatus(orderId, customerProfileId);
    if (!order) {
      return err("Order not found.");
    }
    if (order.status !== "PENDING_PAYMENT") {
      // Already resolved by an earlier attempt (or a stale reload) — report
      // the order's actual state rather than reprocessing.
      return ok({ succeeded: order.status === "CONFIRMED" });
    }

    const providerResult = await mockPaymentProvider.charge(outcome);

    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            orderId,
            reference: generatePaymentReference(),
            provider: "MOCK",
            method: "MOCK",
            amount: order.total,
            currency: order.currency,
            status: providerResult.succeeded ? "SUCCEEDED" : "FAILED",
            providerReference: providerResult.providerEventId,
            confirmedAt: new Date(),
          },
        });
        await tx.idempotencyKey.create({
          data: { key: idempotencyKey, scope: "PAYMENT", resultRef: created.id },
        });
      });
    } catch (error) {
      // Lost a race with a concurrent duplicate submission that claimed
      // this idempotency key first — return its result rather than error.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await resultForExistingKey(idempotencyKey);
        if (raced) {
          return raced;
        }
      }
      console.error("Mock payment attempt failed unexpectedly:", error);
      return err("Something went wrong processing payment. Please try again.");
    }

    if (providerResult.succeeded) {
      const { newFulfilments, customerUserId } = await ordersService.confirmOrderPayment(orderId);
      await dispatchOrderConfirmedNotifications(orderId, order.orderNumber, order.customerProfile.user.email, newFulfilments, customerUserId);
    }

    return ok({ succeeded: providerResult.succeeded });
  },

  // --- Mobile Money — Paystack primary, Moolre experimental/deferred (M10A / M10A.2) ---

  /**
   * Customer submits only orderId + network + phone. Amount/currency are
   * always server-derived from the immutable Order — never trusted from the
   * browser. A DB-level partial unique index (payment_one_active_per_order)
   * is the actual guard against a double-click/double-tab race; this
   * function's own pre-check just gives a friendlier resume-in-place result
   * for the common case. Which real provider actually gets called is
   * decided once, centrally, by `getActivePaymentProvider()` — nothing
   * below this line branches on provider name.
   */
  async initiateMobileMoneyPayment(params: {
    customerProfileId: string;
    orderId: string;
    network: MobileMoneyNetworkCode;
    phone: string;
  }): Promise<Result<PaymentStatusView>> {
    const { customerProfileId, orderId, network, phone } = params;

    const normalizedPhone = normalizeGhanaPhone(phone);
    if (!normalizedPhone) return err("Enter a valid Ghana mobile number.");

    const order = await ordersRepository.findOwnershipAndStatus(orderId, customerProfileId);
    if (!order) return err("Order not found.");
    if (order.status !== "PENDING_PAYMENT") {
      return err("This order can no longer be paid.");
    }

    const activeAttempt = await prisma.payment.findFirst({
      where: { orderId, status: { in: ["INITIATED", "PENDING"] } },
    });
    if (activeAttempt) {
      return ok(toStatusView(activeAttempt));
    }

    const provider = getActivePaymentProvider();
    const attemptNumber = (await prisma.payment.count({ where: { orderId } })) + 1;
    const reference = generatePaymentReference();

    let payment;
    try {
      payment = await prisma.payment.create({
        data: {
          orderId,
          reference,
          provider: provider.name,
          method: "MOBILE_MONEY",
          network,
          amount: order.total,
          currency: order.currency,
          status: "INITIATED",
          phoneMasked: maskGhanaPhone(normalizedPhone),
          attemptNumber,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Lost the race against a concurrent duplicate submission — resume the winner's attempt.
        const winner = await prisma.payment.findFirst({ where: { orderId, status: { in: ["INITIATED", "PENDING"] } } });
        if (winner) return ok(toStatusView(winner));
      }
      console.error("Payment initiation failed unexpectedly:", error);
      return err("Something went wrong starting payment. Please try again.");
    }

    logPaymentEvent("initiation_requested", { paymentId: payment.id, reference, orderId, network, provider: provider.name });

    const outcome = await provider.initiate({
      reference,
      amount: order.total.toNumber(),
      currency: "GHS",
      network,
      phone: normalizedPhone,
      customerEmail: order.customerProfile.user.email,
    });

    return applyInitiateOutcome(payment.id, outcome);
  },

  // --- Cards — Paystack-hosted Checkout only (M10B) ---

  /**
   * Card is always Paystack, regardless of `env.PAYMENT_PROVIDER` (Moolre
   * never supported cards). The customer is redirected to Paystack's own
   * hosted page; CrownSourceGlobal never receives PAN/CVV/PIN/OTP. Shares
   * the exact same Payment table, `payment_one_active_per_order` guard, and
   * post-redirect `applyVerifyOutcome` funnel as Mobile Money — this is the
   * one function that calls a Paystack-specific initiation path instead of
   * the shared `PaymentProvider.initiate()` interface, since that interface
   * is MoMo-shaped (network/phone/otpcode have no card equivalent).
   */
  async initiateCardPayment(params: {
    customerProfileId: string;
    orderId: string;
  }): Promise<Result<{ payment: PaymentStatusView; authorizationUrl: string | null }>> {
    const { customerProfileId, orderId } = params;

    const order = await ordersRepository.findOwnershipAndStatus(orderId, customerProfileId);
    if (!order) return err("Order not found.");
    if (order.status !== "PENDING_PAYMENT") {
      return err("This order can no longer be paid.");
    }

    const activeAttempt = await prisma.payment.findFirst({
      where: { orderId, status: { in: ["INITIATED", "PENDING"] } },
    });
    if (activeAttempt) {
      // No fresh authorization_url to offer for a resumed attempt (Paystack
      // only returns it once, at initiation) — the customer either
      // completes the tab they already opened, or waits for the abandoned-
      // payment sweep to expire this attempt before retrying.
      return ok({ payment: toStatusView(activeAttempt), authorizationUrl: null });
    }

    if (!env.PAYSTACK_SECRET_KEY) {
      logPaymentEvent("card_initiation_unavailable", { orderId, reason: "PAYSTACK_SECRET_KEY not configured" });
      return err("Card payments are not currently available. Please use Mobile Money.");
    }

    const attemptNumber = (await prisma.payment.count({ where: { orderId } })) + 1;
    const reference = generatePaymentReference();

    let payment;
    try {
      payment = await prisma.payment.create({
        data: {
          orderId,
          reference,
          provider: "PAYSTACK",
          method: "CARD",
          amount: order.total,
          currency: order.currency,
          status: "INITIATED",
          attemptNumber,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await prisma.payment.findFirst({ where: { orderId, status: { in: ["INITIATED", "PENDING"] } } });
        if (winner) return ok({ payment: toStatusView(winner), authorizationUrl: null });
      }
      console.error("Card payment initiation failed unexpectedly:", error);
      return err("Something went wrong starting payment. Please try again.");
    }

    logPaymentEvent("initiation_requested", { paymentId: payment.id, reference, orderId, provider: "PAYSTACK", method: "CARD" });

    const outcome = await initiatePaystackCardPayment({
      reference,
      amount: order.total.toNumber(),
      currency: "GHS",
      customerEmail: order.customerProfile.user.email,
      callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/checkout/${orderId}/payment/callback`,
    });

    if (outcome.outcome === "REDIRECT") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "PENDING" } });
      const refreshed = await prisma.payment.findUnique({ where: { id: payment.id } });
      return ok({ payment: toStatusView(refreshed ?? payment), authorizationUrl: outcome.authorizationUrl });
    }
    if (outcome.outcome === "REJECTED") {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: { in: ["INITIATED", "PENDING"] } },
        data: { status: "FAILED", failureReasonSafe: outcome.reasonSafe, providerStatus: outcome.providerStatus },
      });
      return err(outcome.reasonSafe);
    }
    // UNKNOWN (timeout/network) — stays INITIATED, uncertain, never auto-retried.
    logPaymentEvent("initiation_uncertain", { paymentId: payment.id });
    return err(outcome.reasonSafe);
  },

  /**
   * Resubmits the OTP against the SAME reference/attempt — never a new
   * Payment. The phone is re-collected from the client at this step rather
   * than persisted server-side between steps (CLAUDE.md's "store only what's
   * justified"). Uses whichever provider originally created this Payment
   * (`payment.provider`), not necessarily today's active default.
   */
  async submitMobileMoneyOtp(params: {
    customerProfileId: string;
    paymentId: string;
    phone: string;
    otpcode: string;
  }): Promise<Result<PaymentStatusView>> {
    const { customerProfileId, paymentId, phone, otpcode } = params;

    const normalizedPhone = normalizeGhanaPhone(phone);
    if (!normalizedPhone) return err("Enter a valid Ghana mobile number.");
    if (!otpcode.trim()) return err("Enter the OTP code sent to your phone.");

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, order: { customerProfileId } },
      include: { order: { select: { customerProfile: { select: { user: { select: { email: true } } } } } } },
    });
    if (!payment) return err("Payment not found.");
    if (payment.status !== "INITIATED" && payment.status !== "PENDING") {
      return err("This payment can no longer be updated.");
    }
    if (payment.provider === "MOCK") return err("This payment does not use OTP.");
    const currentCode = payment.providerStatus ?? "";
    if (!OTP_REQUIRED_PROVIDER_CODES.includes(currentCode)) {
      return err("No OTP is currently required for this payment.");
    }
    if (payment.network === null) return err("Payment is missing network details.");

    const submittingMarker = `${currentCode}_SUBMITTING`;
    const claimed = await prisma.payment.updateMany({
      where: { id: paymentId, providerStatus: currentCode },
      data: { providerStatus: submittingMarker },
    });
    if (claimed.count !== 1) return err("This OTP is already being verified. Please wait.");

    try {
      const provider = providerForName(payment.provider);
      const outcome = await provider.initiate({
        reference: payment.reference,
        amount: payment.amount.toNumber(),
        currency: "GHS",
        network: payment.network,
        phone: normalizedPhone,
        customerEmail: payment.order.customerProfile.user.email,
        otpcode: otpcode.trim(),
      });

      return await applyInitiateOutcome(paymentId, outcome);
    } catch (error) {
      // Never leave a Payment stuck at the transient "*_SUBMITTING" claim
      // guard forever — that's exactly what happened in earlier testing
      // when the ACCEPTED-branch write threw an unhandled error. No money
      // has moved at this point, so it's safe (and customer-friendliest)
      // to revert and let them resubmit the same OTP, rather than failing
      // the attempt outright.
      console.error("OTP submission failed unexpectedly:", error);
      await prisma.payment.updateMany({ where: { id: paymentId, providerStatus: submittingMarker }, data: { providerStatus: currentCode } });
      return err("Something went wrong confirming your code. Please try again.");
    }
  },

  /**
   * Used by the bounded customer-facing polling endpoint. The browser never
   * queries the provider directly — this always goes through
   * CrownSourceGlobal's own server, and only calls out to the provider when
   * the last verification is stale, never on every single poll tick. Uses
   * whichever provider originally created this Payment.
   */
  async getPaymentStatusForCustomer(paymentId: string, customerProfileId: string): Promise<Result<PaymentStatusView>> {
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, order: { customerProfileId } } });
    if (!payment) return err("Payment not found.");
    if (payment.provider === "MOCK") return ok(toStatusView(payment));

    const isStale = !payment.lastVerifiedAt || Date.now() - payment.lastVerifiedAt.getTime() > 4_000;
    const awaitingOtp = OTP_REQUIRED_PROVIDER_CODES.includes(payment.providerStatus ?? "");
    if ((payment.status === "INITIATED" || payment.status === "PENDING") && isStale && !awaitingOtp) {
      const provider = providerForName(payment.provider);
      const verified = await provider.verify({ reference: payment.reference, providerReference: payment.providerReference });
      await applyVerifyOutcome(paymentId, verified);
      const refreshed = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (refreshed) return ok(toStatusView(refreshed));
    }

    return ok(toStatusView(payment));
  },

  /**
   * Card return-from-Paystack landing (M10B). The browser's return to
   * `callback_url` is NEVER treated as proof of anything — `reference` is
   * used only as a lookup key, scoped to this authenticated customer's own
   * order, and the result always comes from an immediate, independent
   * `provider.verify()` call through the exact same `applyVerifyOutcome`
   * funnel as the webhook and polling paths. If Paystack ever calls back
   * without a reference (or with one that doesn't resolve), falls back to
   * this order's most recent CARD attempt.
   */
  async getCardReturnStatusForCustomer(params: {
    customerProfileId: string;
    orderId: string;
    reference: string | null;
  }): Promise<Result<PaymentStatusView>> {
    const { customerProfileId, orderId, reference } = params;
    const payment = await prisma.payment.findFirst({
      where: {
        orderId,
        order: { customerProfileId },
        method: "CARD",
        ...(reference ? { reference } : {}),
      },
      orderBy: { initiatedAt: "desc" },
    });
    if (!payment) return err("Payment not found.");

    // Card is always Paystack (M10B) — no provider branching needed here.
    const verified = await paystackPaymentProvider.verify({ reference: payment.reference, providerReference: payment.providerReference });
    logPaymentEvent("status_verification", { provider: "PAYSTACK", paymentId: payment.id, status: verified.status, trigger: "card_return" });
    await applyVerifyOutcome(payment.id, verified);

    const refreshed = await prisma.payment.findUnique({ where: { id: payment.id } });
    return refreshed ? ok(toStatusView(refreshed)) : err("Payment not found.");
  },

  /**
   * Thin Moolre webhook business logic — kept for experimental/development
   * use (docs/decisions/0007). The callback body is a TRIGGER only —
   * Moolre documents no signature/HMAC mechanism (best-effort source-IP
   * filtering is applied, logged, but never treated as sufficient proof).
   * Authoritative confirmation always comes from an independent
   * server-to-server status verification call. Always processed
   * idempotently; the route always acks 200 regardless of outcome.
   */
  async handleMoolreWebhook(body: unknown, sourceIp: string | null): Promise<void> {
    const parsed = moolrePaymentProvider.parseWebhook({ body, sourceIp });
    logPaymentEvent("callback_received", { provider: "MOOLRE", recognized: parsed.recognized, sourceIpTrusted: parsed.recognized ? parsed.sourceIpTrusted : false, sourceIp });
    if (!parsed.recognized) {
      logPaymentEvent("callback_ignored", { provider: "MOOLRE", reason: "unrecognized payload" });
      return;
    }

    const payment = parsed.reference
      ? await prisma.payment.findUnique({ where: { reference: parsed.reference } })
      : parsed.providerReference
        ? await prisma.payment.findFirst({ where: { providerReference: parsed.providerReference } })
        : null;

    if (!payment) {
      logPaymentEvent("callback_ignored", { provider: "MOOLRE", reason: "unknown reference", reference: parsed.reference });
      return;
    }

    const verified = await moolrePaymentProvider.verify({ reference: payment.reference, providerReference: payment.providerReference });
    logPaymentEvent("status_verification", { provider: "MOOLRE", paymentId: payment.id, status: verified.status });
    await applyVerifyOutcome(payment.id, verified);
  },

  /**
   * Thin Paystack webhook business logic. Signature verification
   * (HMAC-SHA512, Paystack's documented mechanism) happens in the route
   * handler BEFORE this is ever called — this function receives an
   * already-authenticated, already-JSON-parsed body. Even so, the webhook
   * is still only ever a TRIGGER: this always independently re-verifies via
   * Paystack's own Verify Transaction endpoint before ever confirming an
   * Order, exactly like the Moolre path, and exactly as this milestone's
   * brief requires ("webhook alone should not bypass financial validation").
   */
  async handlePaystackWebhook(body: unknown, sourceIp: string | null): Promise<void> {
    const parsed = paystackPaymentProvider.parseWebhook({ body, sourceIp });
    logPaymentEvent("callback_received", { provider: "PAYSTACK", recognized: parsed.recognized, sourceIpTrusted: parsed.recognized ? parsed.sourceIpTrusted : false, sourceIp });
    if (!parsed.recognized) {
      logPaymentEvent("callback_ignored", { provider: "PAYSTACK", reason: "unrecognized payload" });
      return;
    }

    const payment = parsed.reference
      ? await prisma.payment.findUnique({ where: { reference: parsed.reference } })
      : parsed.providerReference
        ? await prisma.payment.findFirst({ where: { providerReference: parsed.providerReference } })
        : null;

    if (!payment) {
      logPaymentEvent("callback_ignored", { provider: "PAYSTACK", reason: "unknown reference", reference: parsed.reference });
      return;
    }

    const verified = await paystackPaymentProvider.verify({ reference: payment.reference, providerReference: payment.providerReference });
    logPaymentEvent("status_verification", { provider: "PAYSTACK", paymentId: payment.id, status: verified.status });
    await applyVerifyOutcome(payment.id, verified);
  },

  /**
   * Paystack sends refund.* events to the same webhook URL as charge.*
   * events — this is a thin pass-through into the M9 refund domain
   * (modules/resolutions), which owns the actual reconciliation logic
   * (independently re-fetching via GET /refund/:reference, never trusting
   * the webhook body's embedded status alone).
   */
  async handlePaystackRefundWebhook(body: unknown): Promise<void> {
    if (typeof body !== "object" || body === null || !("data" in body)) return;
    const data = (body as { data: unknown }).data;
    if (typeof data !== "object" || data === null || !("id" in data)) return;
    const providerEventId = String((data as { id: unknown }).id);
    logPaymentEvent("refund_callback_received", { providerEventId });
    await resolutionsService.reconcilePaystackRefundByProviderEventId(providerEventId);
  },

  /** Admin reconciliation: query the provider that actually processed this Payment, validate, safely reconcile. Never an unrestricted "mark paid." */
  async reconcilePaymentAsAdmin(paymentId: string): Promise<Result<PaymentStatusView>> {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return err("Payment not found.");
    if (payment.provider === "MOCK") return err("Mock payments cannot be reconciled with a provider.");

    const provider = providerForName(payment.provider);
    const verified = await provider.verify({ reference: payment.reference, providerReference: payment.providerReference });
    logPaymentEvent("reconciliation", { provider: payment.provider, paymentId, status: verified.status });
    await applyVerifyOutcome(paymentId, verified);

    const refreshed = await prisma.payment.findUnique({ where: { id: paymentId } });
    return refreshed ? ok(toStatusView(refreshed)) : err("Payment not found.");
  },

  // --- Admin (M10A) --------------------------------------------------------

  /** Safe summary fields only — never provider debug payloads or full phone numbers. */
  async listForAdmin(filters: { provider?: "MOCK" | "MOOLRE" | "PAYSTACK"; status?: PaymentStatusDb; requiresAttention?: boolean }) {
    const payments = await prisma.payment.findMany({
      where: {
        provider: filters.provider,
        status: filters.status,
        exceptionReason: filters.requiresAttention ? { not: null } : undefined,
      },
      select: {
        id: true,
        reference: true,
        provider: true,
        method: true,
        network: true,
        cardBrand: true,
        cardLast4: true,
        status: true,
        amount: true,
        currency: true,
        phoneMasked: true,
        exceptionReason: true,
        initiatedAt: true,
        confirmedAt: true,
        attemptNumber: true,
        order: { select: { orderNumber: true, customerProfile: { select: { displayName: true } } } },
      },
      orderBy: { initiatedAt: "desc" },
      take: 100,
    });
    return payments;
  },

  async getForAdmin(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        reference: true,
        provider: true,
        method: true,
        network: true,
        cardBrand: true,
        cardLast4: true,
        status: true,
        amount: true,
        currency: true,
        phoneMasked: true,
        providerReference: true,
        providerStatus: true,
        lastVerifiedAt: true,
        failureReasonSafe: true,
        exceptionReason: true,
        attemptNumber: true,
        initiatedAt: true,
        confirmedAt: true,
        order: { select: { id: true, orderNumber: true, customerProfile: { select: { displayName: true, user: { select: { email: true } } } } } },
      },
    });
  },

  /**
   * Abandoned-payment sweep (Workflow F) — a genuine pre-existing gap: no
   * background release of expired reservations existed anywhere before
   * M10A, since the old synchronous mock flow never left an Order in a
   * state that needed one. Cancels Orders whose reservation has expired
   * with no successful Payment, and releases their inventory. Meant to be
   * run periodically (see scripts/sweep-abandoned-payments.ts), same
   * DB-backed-job-not-message-broker architecture as M7's email worker.
   */
  async sweepAbandonedPayments(limit = 50): Promise<{ cancelled: number }> {
    const candidates = await ordersRepository.findAbandonedPendingPayment(new Date(), limit);
    let cancelled = 0;
    for (const { id: orderId } of candidates) {
      const released = await ordersRepository.releaseAbandonedOrderTransactional(orderId);
      if (released) {
        cancelled += 1;
        logPaymentEvent("abandoned_order_cancelled", { orderId });
      }
    }
    return { cancelled };
  },
};

/**
 * Shared by initiate and OTP-resubmit for whichever provider is active —
 * both call `provider.initiate()` and handle its outcome identically.
 *
 * `providerReference` is the provider's own TRANSACTION identifier —
 * genuinely unique per real transaction (confirmed: Moolre's TR099 `data`
 * field and status `transactionid`; Paystack's Verify Transaction `data.id`
 * — see docs/decisions/0006, 0007). It must never be assigned a value we
 * can't prove is uniquely-identifying (see each provider's status-map.ts).
 * This is still a defense-in-depth guard: if `outcome.providerReference`
 * is ever non-null but collides with another Payment's already-claimed
 * value, the conflict must never surface as an unhandled 500 — it's
 * diagnostic-only, never something the Order-confirmation flow depends on
 * (that always keys off this Payment's OWN unique `reference` instead), so
 * it's safe to drop the identifier and continue rather than fail the
 * whole request.
 */
async function applyAcceptedInitiateOutcome(paymentId: string, outcome: { providerReference: string | null; providerStatus: string }): Promise<void> {
  try {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "PENDING", providerReference: outcome.providerReference ?? undefined, providerStatus: outcome.providerStatus },
    });
  } catch (error) {
    const isProviderReferenceCollision =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && outcome.providerReference !== null;
    if (!isProviderReferenceCollision) throw error;

    const conflicting = await prisma.payment.findUnique({
      where: { providerReference: outcome.providerReference! },
      select: { id: true, reference: true, orderId: true },
    });
    logPaymentEvent("provider_reference_collision", {
      paymentId,
      proposedProviderReference: outcome.providerReference,
      conflictingPaymentId: conflicting?.id ?? null,
      conflictingReference: conflicting?.reference ?? null,
      conflictingOrderId: conflicting?.orderId ?? null,
    });

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "PENDING",
        providerStatus: outcome.providerStatus,
        exceptionReason: `Provider reference "${outcome.providerReference}" collided with an existing Payment (${conflicting?.reference ?? "unknown"}) and was not stored. Diagnostic identifier only — this Payment's own confirmation never depends on it.`,
      },
    });

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (payment) {
      await raiseAdminPaymentException(payment.orderId, paymentId, payment.reference, "Provider reference collision detected on initiation (diagnostic identifier only, order confirmation unaffected)");
    }
  }
}

async function applyInitiateOutcome(paymentId: string, outcome: InitiatePaymentOutcome): Promise<Result<PaymentStatusView>> {
  if (outcome.outcome === "ACCEPTED") {
    await applyAcceptedInitiateOutcome(paymentId, outcome);
  } else if (outcome.outcome === "OTP_REQUIRED") {
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "PENDING", providerStatus: outcome.providerStatus } });
  } else if (outcome.outcome === "REJECTED") {
    await prisma.payment.updateMany({
      where: { id: paymentId, status: { in: ["INITIATED", "PENDING"] } },
      data: { status: "FAILED", failureReasonSafe: outcome.reasonSafe, providerStatus: outcome.providerStatus },
    });
  } else {
    // UNKNOWN (timeout/network failure) — stays PENDING/INITIATED, uncertain, never auto-retried.
    logPaymentEvent("initiation_uncertain", { paymentId });
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return err("Payment not found.");

  if (outcome.outcome === "REJECTED") return err(outcome.reasonSafe);
  return ok(toStatusView(payment));
}
