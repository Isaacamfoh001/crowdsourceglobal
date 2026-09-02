import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { vendorFinanceService } from "../../../../../../modules/vendor-finance/service";
import { toVendorEarningSummaryDTO } from "../../../../../../lib/api/dto/vendor";
import { apiError, apiPage, apiSuccess } from "../../../../../../lib/api/response";

/** GET /api/v1/vendor/finance/earnings (M27) — `?status=&page=`. */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const { rows, total, pageSize } = await vendorFinanceService.listEarningsForVendor(context.vendorId, status, page);
  return apiSuccess(apiPage({ rows: rows.map(toVendorEarningSummaryDTO), total, page, pageSize }));
}
