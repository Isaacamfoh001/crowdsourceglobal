import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../lib/api/vendor-context";
import { vendorFinanceService } from "../../../../../../../modules/vendor-finance/service";
import { toVendorSettlementDetailDTO } from "../../../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";

type Params = { id: string };

/** GET /api/v1/vendor/finance/settlements/:id (M27) — scoped to this vendor only. */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;
  const result = await vendorFinanceService.getSettlementDetailForVendor(context.vendorId, id);
  if (!result.ok) return apiError("NOT_FOUND", result.error);
  return apiSuccess(toVendorSettlementDetailDTO(result.value));
}
