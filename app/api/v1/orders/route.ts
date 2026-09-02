import { getCurrentSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { ordersService } from "../../../../modules/orders/service";
import { parsePage } from "../../../../lib/pagination";
import { toOrderListItemDTO } from "../../../../lib/api/dto/orders";
import { apiError, apiPage, apiSuccess } from "../../../../lib/api/response";

/** GET /api/v1/orders (M26) — the signed-in customer's own orders only, newest-first, page-paginated. `?page=`. */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts have orders.");

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  const { rows, total, pageSize } = await ordersService.listOrdersPaginated(customerProfile.id, page);
  return apiSuccess(apiPage({ rows: rows.map(toOrderListItemDTO), total, page, pageSize }));
}
