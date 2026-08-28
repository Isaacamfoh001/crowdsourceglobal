import { getCurrentSession } from "../../../../../modules/identity/policy";
import { serviceRequestsService } from "../../../../../modules/service-requests/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toServiceRequestDTO } from "../../../../../lib/api/dto/service-requests";

type Params = { id: string };

/** GET /api/v1/service-requests/[id] — the signed-in customer's own request only (ownership-scoped, never another customer's). */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const { id } = await params;
  const request = await serviceRequestsService.getForCustomer(session.user.id, id);
  if (!request) return apiError("NOT_FOUND", "Request not found.");
  return apiSuccess(toServiceRequestDTO(request));
}

/** DELETE /api/v1/service-requests/[id] — customer-initiated cancellation, only while still SUBMITTED. */
export async function DELETE(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const { id } = await params;
  const result = await serviceRequestsService.cancel(session.user.id, id);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess({ cancelled: true });
}
