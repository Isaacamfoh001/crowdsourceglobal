import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../lib/api/vendor-context";
import { vendorFinanceService } from "../../../../../modules/vendor-finance/service";
import { toVendorFinanceOverviewDTO } from "../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

/** GET /api/v1/vendor/finance (M27) — earnings/settlement overview, real data only (M27 §19). */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const overview = await vendorFinanceService.getOverviewForVendor(context.vendorId);
  return apiSuccess(toVendorFinanceOverviewDTO(overview));
}
