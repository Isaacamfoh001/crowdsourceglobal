"use server";

import { redirect } from "next/navigation";
import { requireSession } from "../../modules/identity/policy";
import { identityService } from "../../modules/identity/service";
import { paymentsService } from "../../modules/payments/service";
import { requireAdminSession } from "../../modules/administration/policy";
import { err, type Result } from "../result";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../rate-limit";
import { resolveClientIp } from "../request-ip";
import type { MockPaymentOutcome, MobileMoneyNetworkCode, PaymentStatusView } from "../../modules/payments/types";

/**
 * M13 — payment initiation and OTP submission are both real-money-adjacent
 * actions worth throttling: OTP submission is a brute-force target (a
 * bounded code guessed against a real payment), payment initiation calls
 * out to Paystack per attempt. Conservative limits, per (client IP,
 * customer) so one customer's activity never throttles another's — see
 * docs/decisions/0011-production-infrastructure-m13.md.
 */
const OTP_SUBMIT_RATE_LIMIT = { windowSeconds: 300, max: 5 };
const PAYMENT_INITIATE_RATE_LIMIT = { windowSeconds: 300, max: 10 };

const ADMIN_FINANCE_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN"] as const;

export async function attemptMockPaymentAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const orderId = String(formData.get("orderId") ?? "");
  const outcome = String(formData.get("outcome") ?? "") as MockPaymentOutcome;
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");

  const session = await requireSession(`/checkout/${orderId}/payment`);
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  if (!customerProfile) {
    return err("Something went wrong. Please try again.");
  }

  if ((outcome !== "succeed" && outcome !== "fail") || !idempotencyKey) {
    return err("Invalid payment request.");
  }

  const result = await paymentsService.attemptMockPayment({
    customerProfileId: customerProfile.id,
    orderId,
    outcome,
    idempotencyKey,
  });

  if (!result.ok) {
    return result;
  }

  if (result.value.succeeded) {
    redirect(`/account/orders/${orderId}?confirmed=true`);
  }

  return err("Payment declined (simulated). You can try again below.");
}

async function currentCustomerProfileId(orderId: string): Promise<Result<string>> {
  const session = await requireSession(`/checkout/${orderId}/payment`);
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  if (!customerProfile) return err("Something went wrong. Please try again.");
  return { ok: true, value: customerProfile.id };
}

/** Provider-neutral entry point — routes to whichever real provider is active (env.PAYMENT_PROVIDER), Paystack by default. */
export async function initiateMobileMoneyPaymentAction(
  orderId: string,
  network: MobileMoneyNetworkCode,
  phone: string,
): Promise<Result<PaymentStatusView>> {
  const customerProfileId = await currentCustomerProfileId(orderId);
  if (!customerProfileId.ok) return customerProfileId;

  const rateLimit = await checkActionRateLimit(
    `payment-initiate:${await resolveClientIp()}:${customerProfileId.value}`,
    PAYMENT_INITIATE_RATE_LIMIT,
  );
  if (!rateLimit.allowed) return err(RATE_LIMIT_MESSAGE);

  return paymentsService.initiateMobileMoneyPayment({
    customerProfileId: customerProfileId.value,
    orderId,
    network,
    phone,
  });
}

/** Card payments (M10B) — always Paystack-hosted Checkout, regardless of env.PAYMENT_PROVIDER. */
export async function initiateCardPaymentAction(
  orderId: string,
): Promise<Result<{ payment: PaymentStatusView; authorizationUrl: string | null }>> {
  const customerProfileId = await currentCustomerProfileId(orderId);
  if (!customerProfileId.ok) return customerProfileId;

  const rateLimit = await checkActionRateLimit(
    `payment-initiate:${await resolveClientIp()}:${customerProfileId.value}`,
    PAYMENT_INITIATE_RATE_LIMIT,
  );
  if (!rateLimit.allowed) return err(RATE_LIMIT_MESSAGE);

  return paymentsService.initiateCardPayment({
    customerProfileId: customerProfileId.value,
    orderId,
  });
}

export async function submitMobileMoneyOtpAction(
  orderId: string,
  paymentId: string,
  phone: string,
  otpcode: string,
): Promise<Result<PaymentStatusView>> {
  const customerProfileId = await currentCustomerProfileId(orderId);
  if (!customerProfileId.ok) return customerProfileId;

  const rateLimit = await checkActionRateLimit(
    `otp-submit:${await resolveClientIp()}:${customerProfileId.value}`,
    OTP_SUBMIT_RATE_LIMIT,
  );
  if (!rateLimit.allowed) return err(RATE_LIMIT_MESSAGE);

  return paymentsService.submitMobileMoneyOtp({
    customerProfileId: customerProfileId.value,
    paymentId,
    phone,
    otpcode,
  });
}

/** Used by the bounded pending-screen poll. Browser calls this, never the payment provider directly. */
export async function checkMobileMoneyPaymentStatusAction(orderId: string, paymentId: string): Promise<Result<PaymentStatusView>> {
  const customerProfileId = await currentCustomerProfileId(orderId);
  if (!customerProfileId.ok) return customerProfileId;

  return paymentsService.getPaymentStatusForCustomer(paymentId, customerProfileId.value);
}

/** Card return-from-Paystack landing (M10B) — the query-string `reference` is a lookup key only, never trusted as proof; see paymentsService.getCardReturnStatusForCustomer. */
export async function getCardReturnStatusAction(orderId: string, reference: string | null): Promise<Result<PaymentStatusView>> {
  const customerProfileId = await currentCustomerProfileId(orderId);
  if (!customerProfileId.ok) return customerProfileId;

  return paymentsService.getCardReturnStatusForCustomer({
    customerProfileId: customerProfileId.value,
    orderId,
    reference,
  });
}

export async function reconcilePaymentAsAdminAction(paymentId: string): Promise<Result<PaymentStatusView>> {
  await requireAdminSession("/admin/payments", [...ADMIN_FINANCE_ROLES]);
  return paymentsService.reconcilePaymentAsAdmin(paymentId);
}
