import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { beautyProfessionalsService } from "../../../../../../modules/beauty-professionals/service";
import { serviceRequestsService } from "../../../../../../modules/service-requests/service";
import { toVendorServiceRequestDTO } from "../../../../../../lib/api/dto/vendor";
import { apiError, apiPage, apiSuccess } from "../../../../../../lib/api/response";

/**
 * GET /api/v1/vendor/beauty-professional/requests (M27) — CrownSource-
 * mediated service requests addressed to this vendor's Beauty Professional
 * profile. `serviceRequestsService.listForProfessional` is keyed by
 * `BeautyProfessionalProfile.id`, not `vendorId` — resolved via
 * `getForVendor` first, same as the web portal page does. No direct
 * customer contact detail is ever included (see toVendorServiceRequestDTO).
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const profile = await beautyProfessionalsService.getForVendor(context.vendorId);
  if (!profile) return apiError("FORBIDDEN", "This vendor has no Beauty Professional profile.");

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const { rows, total, pageSize } = await serviceRequestsService.listForProfessional(profile.id, page);
  return apiSuccess(apiPage({ rows: rows.map(toVendorServiceRequestDTO), total, page, pageSize }));
}
