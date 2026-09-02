import { z } from "zod";
import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../lib/api/vendor-context";
import { fulfilmentService } from "../../../../../../../modules/fulfilment/service";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";

type Params = { id: string };

const schema = z.object({
  carrier: z.string().trim().min(2, "Enter a carrier name."),
  trackingReference: z.string().trim().min(2, "Enter a tracking reference."),
  shippedAt: z.iso.datetime(),
  expectedArrivalAt: z.iso.datetime().optional(),
});

/**
 * POST /api/v1/vendor/orders/:id/ship (M27) — READY -> DISPATCHED,
 * INTERNATIONAL_INBOUND fulfilments only (a CrownSource receiving
 * destination must already be assigned — the same repository-level
 * guard the web portal's ship action relies on).
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
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check the shipment details.");

  const result = await fulfilmentService.recordVendorShipment(context.vendorId, id, {
    carrier: parsed.data.carrier,
    trackingReference: parsed.data.trackingReference,
    shippedAt: new Date(parsed.data.shippedAt),
    expectedArrivalAt: parsed.data.expectedArrivalAt ? new Date(parsed.data.expectedArrivalAt) : null,
  });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
