import { z } from "zod";

/**
 * Shared delivery-details schema for both cart checkout (lib/actions/checkout.ts)
 * and quote acceptance (lib/actions/quotation.ts) — one Order-creation delivery
 * form, regardless of whether the Order originated from a Cart or an accepted
 * Quotation.
 *
 * M32.9 — `region` is Ghana's own subdivision, not a universal concept, so it
 * is only required when `country` is Ghana (the default, preserving every
 * existing Ghana-only caller unchanged). A non-Ghana delivery (mainly
 * international custom-sourcing quote acceptance) supplies country/city/
 * address lines only — never a fabricated Ghana region. `country` lives in
 * `Order.deliveryInfo`'s existing JSON column, so this needed no migration;
 * the persisted `CustomerAddress` "save for next time" book is a separate,
 * still Ghana-only, real schema table (see modules/addresses) — the
 * international case is deliberately never offered to save into it.
 */
export const deliverySchema = z
  .object({
    recipientName: z.string().trim().min(2, "Enter the recipient's name."),
    phone: z.string().trim().min(9, "Enter a valid phone number."),
    addressLine1: z.string().trim().min(3, "Enter a delivery address."),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().min(2, "Enter a city or town."),
    country: z.string().trim().min(2, "Select a delivery country.").default("Ghana"),
    region: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.country === "Ghana" && !data.region) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a region.", path: ["region"] });
    }
  });

export function parseDeliveryFormData(formData: FormData) {
  return deliverySchema.safeParse({
    recipientName: formData.get("recipientName"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") || undefined,
    city: formData.get("city"),
    country: formData.get("country") || undefined,
    region: formData.get("region") || undefined,
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
  delivery: { recipientName: string; phone: string; addressLine1: string; addressLine2?: string; city: string; region?: string },
): Promise<void> {
  if (formData.get("saveAddress") !== "1") return;
  // The saved-address book (CustomerAddress) is still Ghana-only (no
  // country column) — never save an international delivery into it.
  if (!delivery.region) return;
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
