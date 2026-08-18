import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { ordersService } from "../orders/service";
import type { DeliveryInfo } from "../orders/types";

const initiate = vi.fn();
const verify = vi.fn();
const parseWebhook = vi.fn();

vi.mock("./providers/moolre/adapter", () => ({
  moolrePaymentProvider: {
    name: "MOOLRE",
    initiate: (...args: unknown[]) => initiate(...args),
    verify: (...args: unknown[]) => verify(...args),
    parseWebhook: (...args: unknown[]) => parseWebhook(...args),
  },
}));

const { paymentsService } = await import("./service");

const deliveryInfo: DeliveryInfo = {
  recipientName: "Test Recipient",
  phone: "0244000000",
  addressLine1: "1 Test Street",
  city: "Accra",
  region: "Greater Accra",
};

/** Integration tests against the real local Postgres dev database, with the Moolre HTTP boundary mocked at the adapter. */
describe("paymentsService — Moolre (M10A)", () => {
  let categoryId: string;
  let customerId: string;
  let userId: string;

  const createdOrderIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(() => {
    initiate.mockReset();
    verify.mockReset();
    parseWebhook.mockReset();
  });

  async function setupCustomer() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "Moolre Test Category", slug: `moolre-test-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const user = await prisma.user.create({ data: { id: `moolre-test-user-${suffix}`, name: "Moolre Test User", email: `moolre.${suffix}@example.com` } });
    userId = user.id;
    createdUserIds.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "Moolre Test User" } });
    customerId = customer.id;
    createdCustomerIds.push(customer.id);
  }

  afterAll(async () => {
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function createVendor(suffix: string) {
    const vendor = await prisma.vendor.create({ data: { companyName: `Moolre Vendor ${suffix}`, storefrontSlug: `moolre-vendor-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    return vendor.id;
  }

  async function createPendingOrder(vendorIds: string[], basePrice = 50, quantity = 1) {
    const cart = await prisma.cart.create({ data: { customerProfileId: customerId } });
    for (const vendorId of vendorIds) {
      const listing = await prisma.vendorListing.create({
        data: { vendorId, categoryId, title: "Moolre Test Listing", description: "Fixture.", basePrice, moq: 1, availableQuantity: 20, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
      });
      createdListingIds.push(listing.id);
      await prisma.cartItem.create({ data: { cartId: cart.id, listingId: listing.id, quantity } });
    }

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    if (!result.ok) throw new Error(result.error);
    createdOrderIds.push(result.value.orderId);
    return result.value.orderId;
  }

  it("initiates a payment and stores it PENDING on ACCEPTED", async () => {
    await setupCustomer();
    const vendorId = await createVendor("a");
    const orderId = await createPendingOrder([vendorId]);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "moolre-ref-1", providerStatus: "TR099" });

    const result = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("PENDING");
      expect(result.value.phoneMasked).toBe("024 *** 3456");
    }

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment?.status).toBe("PENDING");
    expect(payment?.providerEventId).toBe("moolre-ref-1");
    expect(payment?.reference).toMatch(/^PAY-/);
  });

  it("routes through the OTP step and succeeds after resubmission with the same reference", async () => {
    await setupCustomer();
    const vendorId = await createVendor("b");
    const orderId = await createPendingOrder([vendorId]);

    initiate.mockResolvedValueOnce({ outcome: "OTP_REQUIRED", providerStatus: "TP14" });
    const first = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.requiresOtp).toBe(true);

    const referenceUsed = initiate.mock.calls[0]?.[0]?.reference;
    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "moolre-ref-otp", providerStatus: "TR099" });

    const second = await paymentsService.submitMoolreOtp({ customerProfileId: customerId, paymentId: first.value.paymentId, phone: "0244123456", otpcode: "1234" });
    expect(second.ok).toBe(true);
    expect(initiate.mock.calls[1]?.[0]?.reference).toBe(referenceUsed); // same externalref, never regenerated
    if (second.ok) expect(second.value.status).toBe("PENDING");
  });

  it("TP17 (phone verification successful) after OTP leaves the Payment pending/processing, then confirms the order exactly once once status verification reports SUCCEEDED", async () => {
    await setupCustomer();
    const vendorId = await createVendor("tp17-a");
    const orderId = await createPendingOrder([vendorId], 90);

    initiate.mockResolvedValueOnce({ outcome: "OTP_REQUIRED", providerStatus: "TP14" });
    const initiated = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: null, providerStatus: "TP17" });
    const otpResult = await paymentsService.submitMoolreOtp({ customerProfileId: customerId, paymentId: initiated.value.paymentId, phone: "0244123456", otpcode: "1234" });
    expect(otpResult.ok).toBe(true);
    if (otpResult.ok) {
      expect(otpResult.value.status).toBe("PENDING");
      expect(otpResult.value.providerStatus).toBe("TP17");
    }

    const orderAfterOtp = await prisma.order.findUnique({ where: { id: orderId } });
    expect(orderAfterOtp?.status).toBe("PENDING_PAYMENT"); // TP17 alone never confirms the order

    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-tp17-a", verifiedAmount: 90, verifiedCurrency: "GHS", providerStatus: "SS01" });
    await paymentsService.getPaymentStatusForCustomer(initiated.value.paymentId, customerId);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CONFIRMED");
    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(1);
    const payments = await prisma.payment.findMany({ where: { orderId, status: "SUCCEEDED" } });
    expect(payments.length).toBe(1);
  });

  it("TP17 followed by a PENDING status verification leaves the order in PENDING_PAYMENT", async () => {
    await setupCustomer();
    const vendorId = await createVendor("tp17-b");
    const orderId = await createPendingOrder([vendorId], 30);

    initiate.mockResolvedValueOnce({ outcome: "OTP_REQUIRED", providerStatus: "TP14" });
    const initiated = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: null, providerStatus: "TP17" });
    await paymentsService.submitMoolreOtp({ customerProfileId: customerId, paymentId: initiated.value.paymentId, phone: "0244123456", otpcode: "1234" });

    verify.mockResolvedValue({ status: "PENDING", providerStatus: "SOME_PENDING_CODE" });
    await paymentsService.getPaymentStatusForCustomer(initiated.value.paymentId, customerId);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("PENDING_PAYMENT");
    const payment = await prisma.payment.findUnique({ where: { id: initiated.value.paymentId } });
    expect(payment?.status).toBe("PENDING");
  });

  it("TP17 followed by a FAILED status verification marks the Payment failed without confirming the order", async () => {
    await setupCustomer();
    const vendorId = await createVendor("tp17-c");
    const orderId = await createPendingOrder([vendorId], 15);

    initiate.mockResolvedValueOnce({ outcome: "OTP_REQUIRED", providerStatus: "TP14" });
    const initiated = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: null, providerStatus: "TP17" });
    await paymentsService.submitMoolreOtp({ customerProfileId: customerId, paymentId: initiated.value.paymentId, phone: "0244123456", otpcode: "1234" });

    verify.mockResolvedValue({ status: "FAILED", reasonSafe: "Payment could not be completed.", providerStatus: "SOME_FAIL_CODE" });
    await paymentsService.getPaymentStatusForCustomer(initiated.value.paymentId, customerId);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("PENDING_PAYMENT");
    const payment = await prisma.payment.findUnique({ where: { id: initiated.value.paymentId } });
    expect(payment?.status).toBe("FAILED");
    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(0);
  });

  // ---- providerEventId collision regression (real sandbox bug) -----------

  it("two independent Orders can each reach TP17 without colliding — providerEventId stays null for both, never a shared placeholder value", async () => {
    await setupCustomer();
    const vendorA = await createVendor("collision-a");
    const vendorB = await createVendor("collision-b");
    const orderA = await createPendingOrder([vendorA], 20);
    const orderB = await createPendingOrder([vendorB], 25);

    initiate.mockResolvedValueOnce({ outcome: "OTP_REQUIRED", providerStatus: "TP14" });
    const initiatedA = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId: orderA, network: "MTN", phone: "0244123456" });
    if (!initiatedA.ok) throw new Error("setup failed");

    initiate.mockResolvedValueOnce({ outcome: "OTP_REQUIRED", providerStatus: "TP14" });
    const initiatedB = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId: orderB, network: "MTN", phone: "0244123456" });
    if (!initiatedB.ok) throw new Error("setup failed");

    // Both attempts receive Moolre's real, observed TP17 outcome shape — a
    // null providerReference, per the fixed status-map — simulating what
    // would previously have been the shared "all" placeholder.
    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: null, providerStatus: "TP17" });
    const otpA = await paymentsService.submitMoolreOtp({ customerProfileId: customerId, paymentId: initiatedA.value.paymentId, phone: "0244123456", otpcode: "1111" });
    expect(otpA.ok).toBe(true); // no unhandled exception

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: null, providerStatus: "TP17" });
    const otpB = await paymentsService.submitMoolreOtp({ customerProfileId: customerId, paymentId: initiatedB.value.paymentId, phone: "0244123456", otpcode: "2222" });
    expect(otpB.ok).toBe(true); // no unhandled exception, no collision with Payment A

    const paymentA = await prisma.payment.findUniqueOrThrow({ where: { id: initiatedA.value.paymentId } });
    const paymentB = await prisma.payment.findUniqueOrThrow({ where: { id: initiatedB.value.paymentId } });
    expect(paymentA.providerEventId).toBeNull();
    expect(paymentB.providerEventId).toBeNull();
    expect(paymentA.status).toBe("PENDING");
    expect(paymentB.status).toBe("PENDING");
  });

  it("a genuine providerEventId collision on initiation fails closed: no unhandled exception, the colliding value is never stored, an exceptionReason is set, and the Payment still reaches a safe PENDING state", async () => {
    await setupCustomer();
    const vendorA = await createVendor("collision-c1");
    const vendorB = await createVendor("collision-c2");
    const orderA = await createPendingOrder([vendorA], 30);
    const orderB = await createPendingOrder([vendorB], 35);

    // Payment A legitimately claims a real (hypothetical) transaction id via TR099.
    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "moolre-txn-shared-123", providerStatus: "TR099" });
    const paidA = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId: orderA, network: "MTN", phone: "0244123456" });
    expect(paidA.ok).toBe(true);
    if (!paidA.ok) return;

    // Payment B — an entirely different Order — somehow reports the exact
    // same provider reference (an undocumented Moolre edge case this
    // defensive path exists for, independent of the TP17 root cause).
    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "moolre-txn-shared-123", providerStatus: "TR099" });
    const paidB = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId: orderB, network: "MTN", phone: "0244555555" });

    expect(paidB.ok).toBe(true); // never an unhandled Prisma exception reaching the caller
    if (!paidB.ok) return;
    expect(paidB.value.status).toBe("PENDING"); // still reaches a safe, usable state

    const paymentB = await prisma.payment.findUniqueOrThrow({ where: { id: paidB.value.paymentId } });
    expect(paymentB.providerEventId).toBeNull(); // the colliding value was never stored
    expect(paymentB.exceptionReason).toMatch(/collided/i);

    const paymentA = await prisma.payment.findFirstOrThrow({ where: { orderId: orderA } });
    expect(paymentA.providerEventId).toBe("moolre-txn-shared-123"); // Payment A's own claim is untouched

    // Order A verifies and confirms normally, legitimately claiming the transaction id.
    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "moolre-txn-shared-123", verifiedAmount: 30, verifiedCurrency: "GHS", providerStatus: "SS01" });
    await paymentsService.getPaymentStatusForCustomer(paidA.value.paymentId, customerId);
    const confirmedOrderA = await prisma.order.findUniqueOrThrow({ where: { id: orderA } });
    expect(confirmedOrderA.status).toBe("CONFIRMED");

    // Order B's own verification now reports the SAME transaction id — a
    // genuine integrity anomaly. It must NEVER also confirm: two Payments
    // independently "succeeding" off one provider transaction is exactly
    // what must never happen. B is flagged for manual review instead.
    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "moolre-txn-shared-123", verifiedAmount: 35, verifiedCurrency: "GHS", providerStatus: "SS01" });
    await paymentsService.getPaymentStatusForCustomer(paymentB.id, customerId);
    const orderBAfter = await prisma.order.findUniqueOrThrow({ where: { id: orderB } });
    expect(orderBAfter.status).toBe("PENDING_PAYMENT"); // never confirmed off a colliding transaction id
    const paymentBAfter = await prisma.payment.findUniqueOrThrow({ where: { id: paymentB.id } });
    expect(paymentBAfter.status).not.toBe("SUCCEEDED");
    expect(paymentBAfter.exceptionReason).toMatch(/already attached/i);
    const fulfilmentsB = await prisma.fulfilment.findMany({ where: { orderId: orderB } });
    expect(fulfilmentsB.length).toBe(0); // no fulfilment ever created for the unconfirmed Order
  });

  it("an unexpected error during OTP submission reverts the transient claim guard instead of leaving the Payment stuck forever", async () => {
    await setupCustomer();
    const vendorId = await createVendor("otp-crash");
    const orderId = await createPendingOrder([vendorId], 22);

    initiate.mockResolvedValueOnce({ outcome: "OTP_REQUIRED", providerStatus: "TP14" });
    const initiated = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    initiate.mockImplementationOnce(() => {
      throw new Error("simulated unexpected provider client failure");
    });
    const result = await paymentsService.submitMoolreOtp({ customerProfileId: customerId, paymentId: initiated.value.paymentId, phone: "0244123456", otpcode: "9999" });
    expect(result.ok).toBe(false); // safe, generic error — not an unhandled exception

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: initiated.value.paymentId } });
    expect(payment.providerStatus).toBe("TP14"); // reverted from TP14_SUBMITTING — customer can retry the OTP

    // Confirm the revert actually allows a real retry, not just a status label.
    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: null, providerStatus: "TP17" });
    const retry = await paymentsService.submitMoolreOtp({ customerProfileId: customerId, paymentId: initiated.value.paymentId, phone: "0244123456", otpcode: "9999" });
    expect(retry.ok).toBe(true);
  });

  it("confirms the order exactly once and creates one Fulfilment on verified success (poll path)", async () => {
    await setupCustomer();
    const vendorId = await createVendor("c");
    const orderId = await createPendingOrder([vendorId], 100);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-c", providerStatus: "TR099" });
    const initiated = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-c", verifiedAmount: 100, verifiedCurrency: "GHS", providerStatus: "SS01" });

    const status = await paymentsService.getPaymentStatusForCustomer(initiated.value.paymentId, customerId);
    expect(status.ok).toBe(true);
    if (status.ok) expect(status.value.status).toBe("SUCCEEDED");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CONFIRMED");
    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(1);
  });

  it("multi-vendor: one Order, two Vendors, one Moolre payment, two Fulfilments after confirmation", async () => {
    await setupCustomer();
    const vendorA = await createVendor("d1");
    const vendorB = await createVendor("d2");
    const orderId = await createPendingOrder([vendorA, vendorB], 60);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-multi", providerStatus: "TR099" });
    const initiated = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-multi", verifiedAmount: order!.total.toNumber(), verifiedCurrency: "GHS", providerStatus: "SS01" });

    await paymentsService.getPaymentStatusForCustomer(initiated.value.paymentId, customerId);

    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(1);
    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(2);
    const vendorIds = new Set(fulfilments.map((f) => f.vendorId));
    expect(vendorIds.size).toBe(2);
  });

  it("duplicate webhook callbacks confirm the order exactly once", async () => {
    await setupCustomer();
    const vendorId = await createVendor("e");
    const orderId = await createPendingOrder([vendorId], 75);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-e", providerStatus: "TR099" });
    const initiated = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    parseWebhook.mockReturnValue({ recognized: true, reference: (await prisma.payment.findUnique({ where: { id: initiated.value.paymentId } }))!.reference, providerReference: "ref-e", claimedSucceeded: true, sourceIpTrusted: false });
    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-e", verifiedAmount: 75, verifiedCurrency: "GHS", providerStatus: "SS01" });

    await paymentsService.handleMoolreWebhook({}, "1.2.3.4");
    await paymentsService.handleMoolreWebhook({}, "1.2.3.4");
    await paymentsService.handleMoolreWebhook({}, "1.2.3.4");

    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(1);
    const payments = await prisma.payment.findMany({ where: { orderId, status: "SUCCEEDED" } });
    expect(payments.length).toBe(1);
  });

  it("never confirms on an amount mismatch — quarantines with an exceptionReason instead", async () => {
    await setupCustomer();
    const vendorId = await createVendor("f");
    const orderId = await createPendingOrder([vendorId], 1000);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-f", providerStatus: "TR099" });
    const initiated = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-f", verifiedAmount: 10, verifiedCurrency: "GHS", providerStatus: "SS01" });
    await paymentsService.getPaymentStatusForCustomer(initiated.value.paymentId, customerId);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("PENDING_PAYMENT");
    const payment = await prisma.payment.findUnique({ where: { id: initiated.value.paymentId } });
    expect(payment?.status).not.toBe("SUCCEEDED");
    expect(payment?.exceptionReason).toContain("mismatch");
  });

  it("retry: a failed attempt followed by a successful one still confirms the order exactly once", async () => {
    await setupCustomer();
    const vendorId = await createVendor("g");
    const orderId = await createPendingOrder([vendorId], 40);

    initiate.mockResolvedValueOnce({ outcome: "REJECTED", reasonSafe: "Simulated rejection", providerStatus: "TP13" });
    const failedAttempt = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    expect(failedAttempt.ok).toBe(false);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-g2", providerStatus: "TR099" });
    const retry = await paymentsService.initiateMoolrePayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;

    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-g2", verifiedAmount: 40, verifiedCurrency: "GHS", providerStatus: "SS01" });
    await paymentsService.getPaymentStatusForCustomer(retry.value.paymentId, customerId);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CONFIRMED");
    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(2);
    expect(payments.filter((p) => p.status === "SUCCEEDED").length).toBe(1);
  });

  it("sweepAbandonedPayments cancels an order with an expired reservation and no successful payment, releasing stock", async () => {
    await setupCustomer();
    const vendorId = await createVendor("h");
    const orderId = await createPendingOrder([vendorId], 20, 3);

    const listingId = (await prisma.orderItem.findFirstOrThrow({ where: { orderId } })).listingId!;
    const before = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });

    await prisma.inventoryReservation.updateMany({ where: { orderId }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    const { cancelled } = await paymentsService.sweepAbandonedPayments();
    expect(cancelled).toBeGreaterThanOrEqual(1);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CANCELLED");
    const after = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(after.availableQuantity).toBe(before.availableQuantity + 3);
  });
});
