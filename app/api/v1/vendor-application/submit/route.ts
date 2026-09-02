import { getCurrentSession } from "../../../../../modules/identity/policy";
import { vendorApplicationsService } from "../../../../../modules/vendor-applications/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

/** POST /api/v1/vendor-application/submit (M27) — mirrors submitApplicationAction exactly. */
export async function POST() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const result = await vendorApplicationsService.submit(session.user.id);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
