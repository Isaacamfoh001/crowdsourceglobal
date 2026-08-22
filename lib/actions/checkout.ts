"use server";

import { redirect } from "next/navigation";
import { requireSession } from "../../modules/identity/policy";
import { identityService } from "../../modules/identity/service";
import { ordersService } from "../../modules/orders/service";
import { err, type Result } from "../result";
import { parseDeliveryFormData, maybeSaveAddressFromCheckout } from "../delivery-schema";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../rate-limit";
import { resolveClientIp } from "../request-ip";
import type { DeliveryInfo } from "../../modules/orders/types";

/**
 * M13 — order creation reserves real inventory per attempt; unthrottled it's
 * a way to repeatedly tie up stock without ever paying. Per (client IP,
 * customer) — see docs/decisions/0011-production-infrastructure-m13.md.
 */
const CHECKOUT_CREATE_RATE_LIMIT = { windowSeconds: 300, max: 10 };

/**
 * Creates the PENDING_PAYMENT Order (ADR 0004 sequencing) then redirects to
 * the mock payment step. Never trusts client-submitted totals — the entire
 * commercial snapshot is recalculated server-side inside
 * ordersService.createOrderFromCart.
 */
export async function createOrderAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const session = await requireSession("/checkout");
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  if (!customerProfile) {
    return err("Something went wrong. Please try again.");
  }

  const rateLimit = await checkActionRateLimit(
    `checkout-create:${await resolveClientIp()}:${customerProfile.id}`,
    CHECKOUT_CREATE_RATE_LIMIT,
  );
  if (!rateLimit.allowed) return err(RATE_LIMIT_MESSAGE);

  const parsed = parseDeliveryFormData(formData);

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Check the delivery details and try again.");
  }

  const deliveryInfo: DeliveryInfo = parsed.data;
  const result = await ordersService.createOrderFromCart(customerProfile.id, deliveryInfo);

  if (!result.ok) {
    return result;
  }

  await maybeSaveAddressFromCheckout(formData, customerProfile.id, deliveryInfo);
  redirect(`/checkout/${result.value.orderId}/payment`);
}
