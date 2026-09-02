import { z } from "zod";
import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../lib/api/vendor-context";
import { vendorListingsService } from "../../../../../../../modules/vendor-listings/service";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";

type Params = { id: string };

const schema = z.object({
  availableQuantity: z.number().int().min(0),
  availabilityStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "MADE_TO_ORDER"]),
});

/**
 * PATCH /api/v1/vendor/listings/:id/inventory (M27) — the vendor mobile
 * stock-adjustment operation (M27 §12). Reuses vendorListingsService.
 * updateInventory unchanged — no separate mobile stock system, no
 * arbitrary "low stock" threshold invented here (the vendor sets
 * availabilityStatus explicitly, same as web).
 */
export async function PATCH(request: Request, { params }: { params: Promise<Params> }) {
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
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Check the quantity and availability status.");

  const result = await vendorListingsService.updateInventory(context.vendorId, id, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
