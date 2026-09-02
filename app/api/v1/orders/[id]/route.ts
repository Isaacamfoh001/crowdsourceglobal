import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { ordersService } from "../../../../../modules/orders/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toOrderSummaryDTO } from "../../../../../lib/api/dto/orders";

type Params = { id: string };

/**
 * GET /api/v1/orders/:id (M24) — ownership-scoped, MINIMAL order read.
 * Added only to back the post-quote-acceptance confirmation screen with a
 * real order reference/status instead of a bare id — see lib/api/dto/
 * orders.ts's doc comment. Full native Orders (list, vendor/fulfilment
 * breakdown, tracking) is M25's scope; do not extend this route ahead of
 * that decision.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("NOT_FOUND", "Order not found.");

  const { id } = await params;
  const order = await ordersService.getOrderDetail(id, customerProfile.id);
  if (!order) return apiError("NOT_FOUND", "Order not found.");

  return apiSuccess(toOrderSummaryDTO(order));
}
