import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../lib/api/vendor-context";
import { sourcingService } from "../../../../../modules/sourcing/service";
import { toVendorSolicitationSummaryDTO } from "../../../../../lib/api/dto/vendor";
import { apiError, apiPage, apiSuccess } from "../../../../../lib/api/response";

/** GET /api/v1/vendor/sourcing-requests (M25.2) — this factory's own solicitation queue only, newest-first, paginated. `?page=`. */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const { rows, total, pageSize } = await sourcingService.listSolicitationsForVendor(context.vendorId, page);
  return apiSuccess(apiPage({ rows: rows.map(toVendorSolicitationSummaryDTO), total, page, pageSize }));
}
