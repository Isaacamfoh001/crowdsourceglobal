"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVendorPortalContext } from "../../modules/vendors/policy";
import { vendorsService } from "../../modules/vendors/service";
import { err, ok, type Result } from "../result";

const storeProfileSchema = z.object({
  companyName: z.string().trim().min(2, "Enter a store name."),
  description: z.string().trim().optional(),
  country: z.string().trim().optional(),
  region: z.string().trim().optional(),
  city: z.string().trim().optional(),
  contactEmail: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  leadTimeDaysDefault: z.coerce.number().int().min(0).optional(),
  pickupAddressLine1: z.string().trim().optional(),
  pickupContactName: z.string().trim().optional(),
  pickupContactPhone: z.string().trim().optional(),
  pickupHours: z.string().trim().optional(),
  pickupNotes: z.string().trim().optional(),
});

export async function updateStoreProfileAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/store");
  const parsed = storeProfileSchema.safeParse({
    companyName: formData.get("companyName"),
    description: formData.get("description") || undefined,
    country: formData.get("country") || undefined,
    region: formData.get("region") || undefined,
    city: formData.get("city") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    leadTimeDaysDefault: formData.get("leadTimeDaysDefault") || undefined,
    pickupAddressLine1: formData.get("pickupAddressLine1") || undefined,
    pickupContactName: formData.get("pickupContactName") || undefined,
    pickupContactPhone: formData.get("pickupContactPhone") || undefined,
    pickupHours: formData.get("pickupHours") || undefined,
    pickupNotes: formData.get("pickupNotes") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check your store profile.");

  const categorySlugs = formData.getAll("categorySlugs").map(String);

  const result = await vendorsService.updateStoreProfile(vendorId, { ...parsed.data, categorySlugs });
  if (!result.ok) return result;
  revalidatePath("/vendor/portal/store");
  return ok(null);
}

/**
 * Real store-logo upload (M29.1) — replaces the old "paste a URL" field.
 * A separate small action from updateStoreProfileAction above so the
 * existing, well-tested text-field form/action stays untouched.
 */
export async function updateStoreLogoAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/store");

  const logo = formData.get("logo");
  if (!(logo instanceof File) || logo.size === 0) {
    return err("Choose a logo image to upload.");
  }

  const result = await vendorsService.updateLogo(vendorId, {
    buffer: Buffer.from(await logo.arrayBuffer()),
    mimeType: logo.type,
  });
  if (!result.ok) return result;
  revalidatePath("/vendor/portal/store");
  return ok(null);
}

export async function removeStoreLogoAction(): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/store");
  const result = await vendorsService.removeLogo(vendorId);
  if (!result.ok) return result;
  revalidatePath("/vendor/portal/store");
  return ok(null);
}
