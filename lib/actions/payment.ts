"use server";

import { redirect } from "next/navigation";
import { requireSession } from "../../modules/identity/policy";
import { identityService } from "../../modules/identity/service";
import { paymentsService } from "../../modules/payments/service";
import { err, type Result } from "../result";
import type { MockPaymentOutcome } from "../../modules/payments/types";

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
