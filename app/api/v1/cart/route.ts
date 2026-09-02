import { getCurrentSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { cartService } from "../../../../modules/cart/service";
import { apiError, apiSuccess } from "../../../../lib/api/response";
import { toCartViewDTO } from "../../../../lib/api/dto/cart";

/**
 * GET /api/v1/cart (M25) — the signed-in customer's active cart, grouped by
 * vendor, with live-resolved unit/bulk pricing (cartService.getCartView —
 * the exact same read the web cart/checkout pages use). Cart is
 * CustomerProfile-owned with no anonymous/guest cart in the approved model
 * (see prisma/schema.prisma's Cart doc comment), so this always requires a
 * signed-in customer — there is no guest-cart variant to reconcile.
 */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts have a cart.");

  const cart = await cartService.getCartView(customerProfile.id);
  return apiSuccess(toCartViewDTO(cart));
}
