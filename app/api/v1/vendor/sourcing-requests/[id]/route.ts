import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { sourcingService } from "../../../../../../modules/sourcing/service";
import { toVendorSolicitationDetailDTO } from "../../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/**
 * GET /api/v1/vendor/sourcing-requests/:id (M25.2) — solicitation detail
 * scoped to this vendor only. getSolicitationDetailForVendor already
 * filters by vendorId at the repository layer — another factory's
 * solicitation (or an unknown id) resolves to null here, the same 404,
 * never a 403 that would confirm the id exists.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;
  const detail = await sourcingService.getSolicitationDetailForVendor(id, context.vendorId);
  if (!detail) return apiError("NOT_FOUND", "Sourcing request not found.");
  return apiSuccess(toVendorSolicitationDetailDTO(detail));
}
