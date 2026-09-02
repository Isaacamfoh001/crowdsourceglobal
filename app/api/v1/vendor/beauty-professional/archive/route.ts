import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { beautyProfessionalsService } from "../../../../../../modules/beauty-professionals/service";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

/** POST /api/v1/vendor/beauty-professional/archive (M27) — unpublish the vendor's own Beauty Professional profile. */
export async function POST() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const result = await beautyProfessionalsService.archive(context.vendorId);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
