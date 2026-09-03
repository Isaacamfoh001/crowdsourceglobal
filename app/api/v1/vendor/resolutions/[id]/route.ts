import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { resolutionsService } from "../../../../../../modules/resolutions/service";
import { toVendorCaseDetailDTO } from "../../../../../../lib/api/dto/resolutions";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/**
 * GET /api/v1/vendor/resolutions/:id (M29.1) — vendor-scoped case detail.
 * Reuses resolutionsService.getForVendor verbatim (already vendor-scoped —
 * a case belonging to another vendor, or one this vendor isn't affected by,
 * resolves 404, never 403, matching every other /api/v1/vendor/* route's
 * anti-enumeration convention). No customer identity/contact/decision/
 * refund data — see toVendorCaseDetailDTO's doc comment.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;
  const caseDetail = await resolutionsService.getForVendor(context.vendorId, id);
  if (!caseDetail) return apiError("NOT_FOUND", "Case not found.");

  return apiSuccess(toVendorCaseDetailDTO(caseDetail));
}
