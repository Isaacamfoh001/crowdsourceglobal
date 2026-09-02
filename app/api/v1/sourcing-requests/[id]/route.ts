import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { sourcingService } from "../../../../../modules/sourcing/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toSourcingRequestDetailDTO } from "../../../../../lib/api/dto/sourcing";

type Params = { id: string };

/**
 * GET /api/v1/sourcing-requests/:id (M24) — ownership-scoped detail, exact
 * same 404-not-403 shape as every other /api/v1 ownership-scoped resource
 * (never reveals whether an id exists to a non-owner — see modules/
 * sourcing/repository.ts's findDetailForCustomer, which already filters by
 * (id, customerProfileId) together).
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("NOT_FOUND", "Sourcing request not found.");

  const { id } = await params;
  const request = await sourcingService.getDetailForCustomer(id, customerProfile.id);
  if (!request) return apiError("NOT_FOUND", "Sourcing request not found.");

  return apiSuccess(toSourcingRequestDetailDTO(request));
}
