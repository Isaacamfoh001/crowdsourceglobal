"use server";

import { revalidatePath } from "next/cache";
import { requireVendorPortalContext } from "../../modules/vendors/policy";
import { beautyProfessionalsService } from "../../modules/beauty-professionals/service";
import { beautyServicesService } from "../../modules/beauty-services/service";
import { serviceRequestsService } from "../../modules/service-requests/service";
import { beautyProfessionalsRepository } from "../../modules/beauty-professionals/repository";
import { ok, type Result } from "../result";

/**
 * Vendor Portal — create/edit the caller's own Beauty Professional profile
 * (M22 §16). `heroImage` is a real Choose/Take Photo upload (M22.1 §4) —
 * `formData.get("heroImage")` is a `File` when the vendor selected a new
 * photo, absent otherwise. `removeHeroImage` is a separate explicit
 * checkbox so "no new file" (leave existing photo alone) and "take the
 * photo down" are distinguishable — see modules/beauty-professionals/service.ts's
 * submitOrUpdate doc comment.
 */
export async function submitBeautyProfessionalProfileAction(
  _prevState: Result<{ status: string }> | null,
  formData: FormData,
): Promise<Result<{ status: string }>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional");

  const heroImageEntry = formData.get("heroImage");
  const heroImageFile =
    heroImageEntry instanceof File && heroImageEntry.size > 0
      ? { buffer: Buffer.from(await heroImageEntry.arrayBuffer()), filename: heroImageEntry.name, mimeType: heroImageEntry.type }
      : undefined;

  const result = await beautyProfessionalsService.submitOrUpdate(vendorId, {
    displayName: String(formData.get("displayName") ?? ""),
    bio: String(formData.get("bio") ?? "") || undefined,
    heroImageFile,
    removeHeroImage: String(formData.get("removeHeroImage") ?? "") === "true",
    specialtyCategorySlugs: formData.getAll("specialtyCategorySlugs").map(String),
    locationMode: (String(formData.get("locationMode") ?? "PROVIDER_LOCATION") as "PROVIDER_LOCATION" | "CUSTOMER_LOCATION" | "BOTH"),
  });
  if (!result.ok) return result;
  revalidatePath("/vendor/portal/beauty-professional");
  return ok(result.value);
}

/** Take down (unpublish) the caller's own live profile. */
export async function archiveBeautyProfessionalProfileAction(): Promise<void> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional");
  await beautyProfessionalsService.archive(vendorId);
  revalidatePath("/vendor/portal/beauty-professional");
}

// --- Services --------------------------------------------------------

export async function createBeautyServiceAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional/services");
  const result = await beautyServicesService.create(vendorId, {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    categoryId: String(formData.get("categoryId") ?? ""),
    startingPrice: String(formData.get("startingPrice") ?? "") || undefined,
  });
  if (!result.ok) return result;
  revalidatePath("/vendor/portal/beauty-professional/services");
  return ok(null);
}

export async function updateBeautyServiceAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional/services");
  const serviceId = String(formData.get("serviceId") ?? "");
  const result = await beautyServicesService.update(vendorId, serviceId, {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
    categoryId: String(formData.get("categoryId") ?? ""),
    startingPrice: String(formData.get("startingPrice") ?? "") || undefined,
  });
  if (!result.ok) return result;
  revalidatePath("/vendor/portal/beauty-professional/services");
  return ok(null);
}

export async function toggleBeautyServiceActiveAction(formData: FormData): Promise<void> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional/services");
  const serviceId = String(formData.get("serviceId") ?? "");
  const active = String(formData.get("active") ?? "true") === "true";
  await beautyServicesService.toggleActive(vendorId, serviceId, active);
  revalidatePath("/vendor/portal/beauty-professional/services");
}

// --- Incoming service requests -----------------------------------------

export async function acceptServiceRequestAction(formData: FormData): Promise<void> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional/requests");
  const profile = await beautyProfessionalsRepository.findForVendor(vendorId);
  if (!profile) return;
  const requestId = String(formData.get("requestId") ?? "");
  await serviceRequestsService.accept(profile.id, requestId);
  revalidatePath("/vendor/portal/beauty-professional/requests");
}

export async function declineServiceRequestAction(formData: FormData): Promise<void> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional/requests");
  const profile = await beautyProfessionalsRepository.findForVendor(vendorId);
  if (!profile) return;
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  await serviceRequestsService.decline(profile.id, requestId, reason);
  revalidatePath("/vendor/portal/beauty-professional/requests");
}
