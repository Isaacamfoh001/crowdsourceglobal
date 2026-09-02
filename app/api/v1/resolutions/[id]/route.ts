import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { ordersService } from "../../../../../modules/orders/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toCustomerCaseDetailDTO } from "../../../../../lib/api/dto/resolutions";

type Params = { id: string };

/**
 * GET /api/v1/resolutions/:id (M26) — read-only resolution-case detail for
 * the owning customer: what was reported, what CrownSource decided, and
 * the real refund/return/replacement outcome. Reuses
 * resolutionsService.getForCustomer verbatim (ownership-scoped already) —
 * no new authorization or business logic. Case CREATION from mobile is
 * deliberately out of scope for this milestone (no mobile
 * upload-capable form for it yet) — see docs/mobile/MOBILE_V1_PLAN.md.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("NOT_FOUND", "Case not found.");

  const { id } = await params;
  const caseDetail = await resolutionsService.getForCustomer(customerProfile.id, id);
  if (!caseDetail) return apiError("NOT_FOUND", "Case not found.");

  // The case's own OrderItem-level amounts have no currency field of their
  // own (only each Refund row does) — read it off the parent Order, same
  // ownership already re-verified above.
  const order = await ordersService.getOrderDetail(caseDetail.orderId, customerProfile.id);
  const currency = order?.currency ?? "GHS";

  return apiSuccess(toCustomerCaseDetailDTO(caseDetail, currency));
}
