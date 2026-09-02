import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { ordersService } from "../../../../../modules/orders/service";
import { fulfilmentService } from "../../../../../modules/fulfilment/service";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toOrderDetailDTO, toCustomerTrackingDTO, toOrderCaseSummaryDTO } from "../../../../../lib/api/dto/orders";

type Params = { id: string };

/**
 * GET /api/v1/orders/:id (M26) — full customer-facing order detail:
 * vendor/fulfilment breakdown, per-package tracking timeline, payment
 * status, and any resolution cases touching this order. Supersedes the M24
 * minimal shape (see lib/api/dto/orders.ts's toOrderSummaryDTO doc
 * comment) — every field that shape returned is still present here, so the
 * existing quote-confirmation/payment screens (which only read a subset)
 * keep working unchanged. Ownership is enforced throughout by
 * `ordersService.getOrderDetail` (id + customerProfileId together) — an
 * unknown or another customer's order id both resolve to 404, never 403
 * (anti-enumeration).
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("NOT_FOUND", "Order not found.");

  const { id } = await params;
  const order = await ordersService.getOrderDetail(id, customerProfile.id);
  if (!order) return apiError("NOT_FOUND", "Order not found.");

  // Same gate the web Order Detail page uses — tracking only exists once
  // Fulfilments have actually been created (payment confirmed).
  const tracking =
    order.status === "CONFIRMED" || order.status === "FULFILLING" || order.status === "COMPLETED"
      ? await fulfilmentService.getCustomerTracking(id, customerProfile.id)
      : [];

  const allCases = await resolutionsService.listForCustomer(customerProfile.id);
  const orderCases = allCases.filter((c) => c.orderId === id);

  return apiSuccess({
    ...toOrderDetailDTO(order),
    tracking: toCustomerTrackingDTO(tracking),
    cases: orderCases.map(toOrderCaseSummaryDTO),
  });
}
