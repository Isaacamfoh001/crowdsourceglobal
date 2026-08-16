import { z } from "zod";

/**
 * Shared delivery-details schema for both cart checkout (lib/actions/checkout.ts)
 * and quote acceptance (lib/actions/quotation.ts) — one Order-creation delivery
 * form, regardless of whether the Order originated from a Cart or an accepted
 * Quotation.
 */
export const deliverySchema = z.object({
  recipientName: z.string().trim().min(2, "Enter the recipient's name."),
  phone: z.string().trim().min(9, "Enter a valid phone number."),
  addressLine1: z.string().trim().min(3, "Enter a delivery address."),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2, "Enter a city or town."),
  region: z.string().trim().min(2, "Select a region."),
  notes: z.string().trim().optional(),
});

export function parseDeliveryFormData(formData: FormData) {
  return deliverySchema.safeParse({
    recipientName: formData.get("recipientName"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city"),
    region: formData.get("region"),
    notes: formData.get("notes") || undefined,
  });
}
