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

/**
 * "Save this address for next time" (components/checkout/DeliveryAddressFields.tsx)
 * is a best-effort convenience side-effect, never load-bearing for the
 * checkout/Order-creation path itself — a failure here must never fail the
 * checkout that already succeeded. Shared by both cart checkout
 * (lib/actions/checkout.ts) and quote acceptance (lib/actions/quotation.ts).
 */
export async function maybeSaveAddressFromCheckout(
  formData: FormData,
  customerProfileId: string,
  delivery: { recipientName: string; phone: string; addressLine1: string; addressLine2?: string; city: string; region: string },
): Promise<void> {
  if (formData.get("saveAddress") !== "1") return;
  try {
    const { addressesService } = await import("../modules/addresses/service");
    await addressesService.create(customerProfileId, {
      label: String(formData.get("label") ?? "") || undefined,
      recipientName: delivery.recipientName,
      phone: delivery.phone,
      addressLine1: delivery.addressLine1,
      addressLine2: delivery.addressLine2,
      city: delivery.city,
      region: delivery.region,
    });
  } catch (error) {
    console.error("Failed to save address from checkout (non-blocking):", error);
  }
}
