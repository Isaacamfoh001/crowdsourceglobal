import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../lib/api/vendor-context";
import { beautyProfessionalsService } from "../../../../../../../modules/beauty-professionals/service";
import { serviceRequestsService } from "../../../../../../../modules/service-requests/service";
import { toVendorServiceRequestDTO } from "../../../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";

type Params = { id: string };

/** GET /api/v1/vendor/beauty-professional/requests/:id (M27) — scoped to this vendor's own professional profile. */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const profile = await beautyProfessionalsService.getForVendor(context.vendorId);
  if (!profile) return apiError("FORBIDDEN", "This vendor has no Beauty Professional profile.");

  const { id } = await params;
  const request_ = await serviceRequestsService.getForProfessional(profile.id, id);
  if (!request_) return apiError("NOT_FOUND", "Request not found.");
  return apiSuccess(toVendorServiceRequestDTO(request_));
}
