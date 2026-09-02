import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../lib/api/vendor-context";
import { fulfilmentService } from "../../../../../../../modules/fulfilment/service";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";

type Params = { id: string };

/** POST /api/v1/vendor/orders/:id/start-preparing (M27) — PENDING -> PREPARING. Only this next valid transition is exposed; the backend still enforces fromStatuses=["PENDING"]. */
export async function POST(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;
  const result = await fulfilmentService.startPreparing(context.vendorId, id);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
