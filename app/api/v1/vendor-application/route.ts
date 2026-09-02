import { getCurrentSession } from "../../../../modules/identity/policy";
import { vendorApplicationsService } from "../../../../modules/vendor-applications/service";
import { toVendorApplicationDTO } from "../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../lib/api/response";

/**
 * GET /api/v1/vendor-application (M27) — mobile's "Start selling" entry
 * point. Get-or-create, mirroring the web `startApplicationAction` (lib/
 * actions/vendor-application.ts) exactly: a signed-in user with no draft
 * yet gets one created on first call, same as tapping "Start selling" on
 * web creates the DRAFT row before routing to step 1. `GET /api/v1/me`
 * stays read-only (vendorApplicationsService.getForUser) — this is the
 * only mobile route with the create side effect, called only when the
 * user actually opts into onboarding.
 */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const application = await vendorApplicationsService.getOrCreateForUser(session.user.id);
  return apiSuccess(toVendorApplicationDTO(application));
}
