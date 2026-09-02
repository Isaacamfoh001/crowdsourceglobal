import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { paymentsService } from "../../../../../modules/payments/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toPaymentStatusDTO } from "../../../../../lib/api/dto/payments";

type Params = { id: string };

/**
 * GET /api/v1/payments/:id (M25) — the bounded customer-facing status poll,
 * reusing paymentsService.getPaymentStatusForCustomer exactly (same
 * ownership scoping, same "only re-verify against the provider when the
 * last check is stale" behavior the web polling actions use). This is also
 * how the mobile client resolves a Card payment after the in-app browser
 * (which does not share the native app's session) is dismissed — see the
 * card initiation route's doc comment. The mobile client never queries
 * Paystack directly; this always goes through CrownSourceGlobal's server.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts can view payment status.");

  const { id } = await params;

  const result = await paymentsService.getPaymentStatusForCustomer(id, customerProfile.id);
  if (!result.ok) return apiError("NOT_FOUND", result.error);

  return apiSuccess(toPaymentStatusDTO(result.value));
}
