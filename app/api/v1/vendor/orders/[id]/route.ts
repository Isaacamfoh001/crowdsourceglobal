import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { fulfilmentService } from "../../../../../../modules/fulfilment/service";
import { toVendorFulfilmentDetailDTO } from "../../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/**
 * GET /api/v1/vendor/orders/:id (M27) — fulfilment detail scoped to this
 * vendor only. `fulfilmentService.getDetailForVendor` already filters by
 * `vendorId` at the repository layer (see the M27 multi-vendor privacy
 * requirement) — a fulfilment belonging to another vendor resolves to
 * `null` here, same 404 an unknown id would get, never a 403 that would
 * confirm the id exists.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;
  const detail = await fulfilmentService.getDetailForVendor(context.vendorId, id);
  if (!detail) return apiError("NOT_FOUND", "Order not found.");
  return apiSuccess(toVendorFulfilmentDetailDTO(detail));
}
