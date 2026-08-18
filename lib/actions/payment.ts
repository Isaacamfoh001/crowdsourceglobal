"use server";

import { redirect } from "next/navigation";
import { requireSession } from "../../modules/identity/policy";
import { identityService } from "../../modules/identity/service";
import { paymentsService } from "../../modules/payments/service";
import { requireAdminSession } from "../../modules/administration/policy";

const ADMIN_FINANCE_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN"] as const;
import { err, type Result } from "../result";
import type { MockPaymentOutcome, MoolreNetworkCode, PaymentStatusView } from "../../modules/payments/types";

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

export async function initiateMoolrePaymentAction(
  orderId: string,
  network: MoolreNetworkCode,
  phone: string,
): Promise<Result<PaymentStatusView>> {
  const customerProfileId = await currentCustomerProfileId(orderId);
  if (!customerProfileId.ok) return customerProfileId;

  return paymentsService.initiateMoolrePayment({
    customerProfileId: customerProfileId.value,
    orderId,
    network,
    phone,
  });
}

export async function submitMoolreOtpAction(
  orderId: string,
  paymentId: string,
  phone: string,
  otpcode: string,
): Promise<Result<PaymentStatusView>> {
  const customerProfileId = await currentCustomerProfileId(orderId);
  if (!customerProfileId.ok) return customerProfileId;

  return paymentsService.submitMoolreOtp({
    customerProfileId: customerProfileId.value,
    paymentId,
    phone,
    otpcode,
  });
}

/** Used by the bounded pending-screen poll. Browser calls this, never Moolre directly. */
export async function checkMoolrePaymentStatusAction(orderId: string, paymentId: string): Promise<Result<PaymentStatusView>> {
  const customerProfileId = await currentCustomerProfileId(orderId);
  if (!customerProfileId.ok) return customerProfileId;

  return paymentsService.getPaymentStatusForCustomer(paymentId, customerProfileId.value);
}

export async function reconcilePaymentAsAdminAction(paymentId: string): Promise<Result<PaymentStatusView>> {
  await requireAdminSession("/admin/payments", [...ADMIN_FINANCE_ROLES]);
  return paymentsService.reconcilePaymentAsAdmin(paymentId);
}
