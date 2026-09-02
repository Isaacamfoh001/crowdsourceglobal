import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { addressesService } from "../../../../../modules/addresses/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

/**
 * GET /api/v1/me/addresses (M24) — the signed-in customer's saved delivery
 * addresses, for the quote-acceptance delivery step to offer "use a saved
 * address" instead of retyping (mirrors components/checkout/
 * DeliveryAddressFields.tsx's web behavior). AddressView already has no
 * fields beyond what a customer should see about their own addresses, so
 * no separate DTO mapper is needed.
 */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts have saved addresses.");

  const addresses = await addressesService.listForCustomer(customerProfile.id);
  return apiSuccess(addresses);
}
