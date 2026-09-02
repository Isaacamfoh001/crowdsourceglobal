import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../../modules/identity/policy";
import { ordersService } from "../../../../../../modules/orders/service";
import { addressesService } from "../../../../../../modules/addresses/service";
import { deliverySchema } from "../../../../../../lib/delivery-schema";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/**
 * POST /api/v1/quotations/:id/accept (M24) — quote acceptance, reusing the
 * exact same ordersService.createOrderFromQuotation the web checkout/quote
 * flow calls (see lib/actions/quotation.ts's createOrderFromQuoteAction).
 * Same delivery-details validation (lib/delivery-schema.ts's deliverySchema
 * — shared with cart checkout too) and the same idempotency guarantee: a
 * repeat call against an already-ACCEPTED quotation returns the existing
 * orderId rather than erroring or creating a second Order.
 *
 * This creates a PENDING_PAYMENT Order — nothing more. Native payment is
 * M25's scope (CLAUDE.md's payment boundary); the mobile client shows that
 * honestly rather than faking completion. There is no "reject" endpoint:
 * the web customer surface has no reject action either (an unwanted
 * CUSTOM_SOURCING quote is simply left to expire), so mobile doesn't invent
 * one.
 *
 * JSON body: recipientName, phone, addressLine1, addressLine2?, city,
 * region (must be one of orders/types.ts's GHANA_REGIONS), notes?,
 * saveAddress? (best-effort, non-blocking — see addressesService.create).
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to accept this quotation.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts can accept a quotation.");

  const { id } = await params;

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

  const result = await ordersService.createOrderFromQuotation(customerProfile.id, id, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  if (body && typeof body === "object" && "saveAddress" in body && (body as { saveAddress?: unknown }).saveAddress === true) {
    try {
      await addressesService.create(customerProfile.id, parsed.data);
    } catch (error) {
      console.error("Failed to save address from mobile quote acceptance (non-blocking):", error);
    }
  }

  return apiSuccess({ orderId: result.value.orderId });
}
