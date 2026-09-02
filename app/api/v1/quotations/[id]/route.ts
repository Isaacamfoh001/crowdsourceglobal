import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { quotationService } from "../../../../../modules/quotation/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toQuotationDetailDTO } from "../../../../../lib/api/dto/quotation";

type Params = { id: string };

/** GET /api/v1/quotations/:id (M24) — ownership-scoped detail (see modules/quotation/repository.ts's findDetailForCustomer). */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("NOT_FOUND", "Quotation not found.");

  const { id } = await params;
  const quotation = await quotationService.getDetailForCustomer(id, customerProfile.id);
  if (!quotation) return apiError("NOT_FOUND", "Quotation not found.");

  return apiSuccess(toQuotationDetailDTO(quotation));
}
