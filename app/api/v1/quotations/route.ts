import { getCurrentSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { quotationService } from "../../../../modules/quotation/service";
import { parsePage } from "../../../../lib/pagination";
import { apiError, apiPage, apiSuccess } from "../../../../lib/api/response";
import { toQuotationSummaryDTO } from "../../../../lib/api/dto/quotation";

/**
 * GET /api/v1/quotations (M24) — the signed-in customer's own quotations
 * (both INSTANT/bulk and CUSTOM_SOURCING origin — `origin` is an admin-only
 * field per modules/quotation/types.ts, so it's intentionally absent here),
 * newest-first, page-paginated.
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts can view quotations.");

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  const { rows, total, pageSize } = await quotationService.listForCustomer(customerProfile.id, page);
  return apiSuccess(apiPage({ rows: rows.map(toQuotationSummaryDTO), total, page, pageSize }));
}
