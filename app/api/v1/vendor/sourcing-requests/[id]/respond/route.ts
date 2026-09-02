import { z } from "zod";
import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../lib/api/vendor-context";
import { sourcingService } from "../../../../../../../modules/sourcing/service";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";

type Params = { id: string };

const schema = z.discriminatedUnion("canFulfil", [
  z.object({ canFulfil: z.literal(false) }),
  z.object({
    canFulfil: z.literal(true),
    proposedQuantity: z.coerce.number().int().positive("Enter a valid quantity."),
    unitPrice: z.coerce.number().positive("Enter a unit price greater than zero."),
    leadTimeDays: z.coerce.number().int().nonnegative().optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
]);

/**
 * POST /api/v1/vendor/sourcing-requests/:id/respond (M25.2) — the factory's
 * CAN FULFIL / CANNOT FULFIL response. sourcingService.respondToSolicitation
 * enforces ownership (vendorId) and the SENT-only state guard atomically —
 * never trusts vendorId from the request body.
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check your response and try again.");

  const result = await sourcingService.respondToSolicitation(id, context.vendorId, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
