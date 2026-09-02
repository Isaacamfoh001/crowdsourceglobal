import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { cartService } from "../../../../../modules/cart/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toCartViewDTO } from "../../../../../lib/api/dto/cart";

/**
 * POST /api/v1/cart/items (M25) — add a listing to the signed-in customer's
 * cart, reusing cartService.addToCart exactly (same MOQ/maxOq/availability
 * validation as the web Add to Cart action). Returns the refreshed cart
 * view so the mobile client never has to separately re-fetch after a
 * mutation.
 *
 * JSON body: { listingId: string, quantity: number }
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to add items to your cart.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts have a cart.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }

  const listingId = typeof body === "object" && body !== null ? (body as { listingId?: unknown }).listingId : undefined;
  const quantity = typeof body === "object" && body !== null ? (body as { quantity?: unknown }).quantity : undefined;

  if (typeof listingId !== "string" || !listingId) {
    return apiError("VALIDATION_ERROR", "listingId is required.");
  }
  if (typeof quantity !== "number") {
    return apiError("VALIDATION_ERROR", "quantity must be a number.");
  }

  const result = await cartService.addToCart(customerProfile.id, listingId, quantity);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  const cart = await cartService.getCartView(customerProfile.id);
  return apiSuccess(toCartViewDTO(cart));
}
