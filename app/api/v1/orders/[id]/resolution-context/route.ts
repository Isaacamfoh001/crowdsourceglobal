import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../../modules/identity/policy";
import { resolutionsService } from "../../../../../../modules/resolutions/service";
import { ordersService } from "../../../../../../modules/orders/service";
import { toResolutionContextDTO } from "../../../../../../lib/api/dto/resolutions";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/**
 * GET /api/v1/orders/:id/resolution-context (M29.1) — backs mobile's
 * "Report a problem" entry point. Reuses resolutionsService.
 * getOrderContextForCustomer verbatim (the exact same context the web
 * ReportProblemForm uses) — cancellation eligibility is never re-derived
 * client-side. Ownership-scoped: an unknown/foreign order 404s.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("NOT_FOUND", "Order not found.");

  const { id } = await params;
  const context = await resolutionsService.getOrderContextForCustomer(id, customerProfile.id);
  if (!context) return apiError("NOT_FOUND", "Order not found.");

  const order = await ordersService.getOrderDetail(id, customerProfile.id);
  const currency = order?.currency ?? "GHS";

  return apiSuccess(toResolutionContextDTO(context, currency));
}
