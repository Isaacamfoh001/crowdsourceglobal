import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../lib/api/vendor-context";
import { beautyProfessionalsService } from "../../../../../modules/beauty-professionals/service";
import { toVendorBeautyProfileDTO } from "../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

/** GET /api/v1/vendor/beauty-professional (M27) — this vendor's Beauty Professional profile, or null if they haven't applied to be one (M27 §16). */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const profile = await beautyProfessionalsService.getForVendor(context.vendorId);
  return apiSuccess(profile ? toVendorBeautyProfileDTO(profile) : null);
}

/**
 * PATCH /api/v1/vendor/beauty-professional (M27) — create (first
 * submission) or edit a Beauty Professional profile. `multipart/form-data`:
 * displayName, bio?, specialtyCategorySlugs (repeated field),
 * locationMode, heroImage? (0-1 new file part), removeHeroImage?
 * ("true"/"false"). Real photo upload only, same rule as listings/Explore
 * — never a pasted URL.
 */
export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected multipart/form-data.");
  }

  const heroImageEntry = formData.get("heroImage");
  const heroImageFile =
    heroImageEntry instanceof File && heroImageEntry.size > 0
      ? { buffer: Buffer.from(await heroImageEntry.arrayBuffer()), filename: heroImageEntry.name, mimeType: heroImageEntry.type }
      : undefined;

  const result = await beautyProfessionalsService.submitOrUpdate(context.vendorId, {
    displayName: String(formData.get("displayName") ?? ""),
    bio: formData.get("bio") ? String(formData.get("bio")) : undefined,
    specialtyCategorySlugs: formData.getAll("specialtyCategorySlugs").map(String),
    locationMode: String(formData.get("locationMode") ?? "PROVIDER_LOCATION") as never,
    heroImageFile,
    removeHeroImage: formData.get("removeHeroImage") === "true",
  });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(result.value);
}
