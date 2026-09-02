import { getCurrentSession } from "../../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../../lib/api/vendor-context";
import { beautyProfessionalsService } from "../../../../../../../../modules/beauty-professionals/service";
import { serviceRequestsService } from "../../../../../../../../modules/service-requests/service";
import { apiError, apiSuccess } from "../../../../../../../../lib/api/response";

type Params = { id: string };

/** POST /api/v1/vendor/beauty-professional/requests/:id/accept (M27). */
export async function POST(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const profile = await beautyProfessionalsService.getForVendor(context.vendorId);
  if (!profile) return apiError("FORBIDDEN", "This vendor has no Beauty Professional profile.");

  const { id } = await params;
  const result = await serviceRequestsService.accept(profile.id, id);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
