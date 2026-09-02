import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../../modules/identity/policy";
import { cartService } from "../../../../../../modules/cart/service";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";
import { toCartViewDTO } from "../../../../../../lib/api/dto/cart";

type Params = { id: string };

/**
 * PATCH /api/v1/cart/items/:id (M25) — update a cart line's quantity,
 * reusing cartService.updateQuantity exactly (ownership-scoped, same
 * MOQ/maxOq/availability revalidation as the web quantity stepper; a
 * quantity of 0 or less removes the line, same as web). Returns the
 * refreshed cart view.
 *
 * JSON body: { quantity: number }
 */
export async function PATCH(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to manage your cart.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts have a cart.");

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }

  const quantity = typeof body === "object" && body !== null ? (body as { quantity?: unknown }).quantity : undefined;
  if (typeof quantity !== "number") {
    return apiError("VALIDATION_ERROR", "quantity must be a number.");
  }

  const result = await cartService.updateQuantity(customerProfile.id, id, quantity);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  const cart = await cartService.getCartView(customerProfile.id);
  return apiSuccess(toCartViewDTO(cart));
}

/**
 * DELETE /api/v1/cart/items/:id (M25) — remove a cart line, reusing
 * cartService.removeItem exactly (ownership-scoped — a customer can never
 * remove another customer's cart item, it simply reports not found).
 * Returns the refreshed cart view.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to manage your cart.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts have a cart.");

  const { id } = await params;

  const result = await cartService.removeItem(customerProfile.id, id);
  if (!result.ok) return apiError("NOT_FOUND", result.error);

  const cart = await cartService.getCartView(customerProfile.id);
  return apiSuccess(toCartViewDTO(cart));
}
