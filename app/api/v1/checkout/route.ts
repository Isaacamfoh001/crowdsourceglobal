import { getCurrentSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { ordersService } from "../../../../modules/orders/service";
import { addressesService } from "../../../../modules/addresses/service";
import { deliverySchema } from "../../../../lib/delivery-schema";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../lib/rate-limit";
import { resolveIpFromRequest } from "../../../../lib/api/request-ip";
import { apiError, apiSuccess } from "../../../../lib/api/response";

/** Same throttle as lib/actions/checkout.ts's createOrderAction — order creation reserves real inventory per attempt. */
const CHECKOUT_CREATE_RATE_LIMIT = { windowSeconds: 300, max: 10 };

/**
 * POST /api/v1/checkout (M25) — cart → PENDING_PAYMENT Order, reusing
 * ordersService.createOrderFromCart exactly (the same transaction that
 * revalidates listing status/MOQ/maxOq, atomically decrements inventory,
 * creates the 15-minute InventoryReservation, and marks the Cart
 * CONVERTED — see modules/orders/service.ts). Server-authoritative: the
 * mobile client sends only delivery details, never a total. This is
 * cart-checkout only — quote acceptance already has its own endpoint,
 * POST /api/v1/quotations/:id/accept (M24).
 *
 * JSON body: recipientName, phone, addressLine1, addressLine2?, city,
 * region (must be one of modules/orders/types.ts's GHANA_REGIONS), notes?,
 * saveAddress? (best-effort, non-blocking).
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to check out.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts can check out.");

  const rateLimit = await checkActionRateLimit(
    `checkout-create:${resolveIpFromRequest(request)}:${customerProfile.id}`,
    CHECKOUT_CREATE_RATE_LIMIT,
  );
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }

  const parsed = deliverySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check the delivery details and try again.");
  }

  const result = await ordersService.createOrderFromCart(customerProfile.id, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  if (body && typeof body === "object" && "saveAddress" in body && (body as { saveAddress?: unknown }).saveAddress === true) {
    try {
      await addressesService.create(customerProfile.id, parsed.data);
    } catch (error) {
      console.error("Failed to save address from mobile checkout (non-blocking):", error);
    }
  }

  return apiSuccess({ orderId: result.value.orderId });
}
