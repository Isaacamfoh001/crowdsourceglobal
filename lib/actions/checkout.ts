"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "../../modules/identity/policy";
import { identityService } from "../../modules/identity/service";
import { ordersService } from "../../modules/orders/service";
import { err, type Result } from "../result";
import type { DeliveryInfo } from "../../modules/orders/types";

const deliverySchema = z.object({
  recipientName: z.string().trim().min(2, "Enter the recipient's name."),
  phone: z.string().trim().min(9, "Enter a valid phone number."),
  addressLine1: z.string().trim().min(3, "Enter a delivery address."),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2, "Enter a city or town."),
  region: z.string().trim().min(2, "Select a region."),
  notes: z.string().trim().optional(),
});

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

  const parsed = deliverySchema.safeParse({
    recipientName: formData.get("recipientName"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city"),
    region: formData.get("region"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Check the delivery details and try again.");
  }

  const deliveryInfo: DeliveryInfo = parsed.data;
  const result = await ordersService.createOrderFromCart(customerProfile.id, deliveryInfo);

  if (!result.ok) {
    return result;
  }

  redirect(`/checkout/${result.value.orderId}/payment`);
}
