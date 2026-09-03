import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../lib/api/vendor-context";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { toVendorCaseSummaryDTO } from "../../../../../lib/api/dto/resolutions";
import { apiError, apiPage, apiSuccess } from "../../../../../lib/api/response";

/**
 * GET /api/v1/vendor/resolutions (M29.1) — this vendor's own resolution
 * cases only, newest-first, paginated. `?page=`. Thin route over the
 * EXISTING resolutionsService.listForVendorPaginated (already used by the
 * web Vendor Portal, M9/M11.1) — no new business logic. Deliberately
 * restricted view (M9 §46): no customer identity/contact/description.
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const { rows, total, pageSize } = await resolutionsService.listForVendorPaginated(context.vendorId, page);
  return apiSuccess(apiPage({ rows: rows.map(toVendorCaseSummaryDTO), total, page, pageSize }));
}
