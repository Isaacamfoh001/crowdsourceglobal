"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVendorPortalContext } from "../../modules/vendors/policy";
import { vendorsService } from "../../modules/vendors/service";
import { err, ok, type Result } from "../result";

const storeProfileSchema = z.object({
  companyName: z.string().trim().min(2, "Enter a store name."),
  description: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  country: z.string().trim().optional(),
  region: z.string().trim().optional(),
  city: z.string().trim().optional(),
  contactEmail: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  leadTimeDaysDefault: z.coerce.number().int().min(0).optional(),
});

export async function updateStoreProfileAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/store");
  const parsed = storeProfileSchema.safeParse({
    companyName: formData.get("companyName"),
    description: formData.get("description") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    country: formData.get("country") || undefined,
    region: formData.get("region") || undefined,
    city: formData.get("city") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    leadTimeDaysDefault: formData.get("leadTimeDaysDefault") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check your store profile.");

  const categorySlugs = formData.getAll("categorySlugs").map(String);

  const result = await vendorsService.updateStoreProfile(vendorId, { ...parsed.data, categorySlugs });
  if (!result.ok) return result;
  revalidatePath("/vendor/portal/store");
  return ok(null);
}
