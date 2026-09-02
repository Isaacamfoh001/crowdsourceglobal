import { z } from "zod";
import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { vendorFinanceService } from "../../../../../../modules/vendor-finance/service";
import { toPayoutDestinationDTO } from "../../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

/** GET /api/v1/vendor/finance/payout-destination (M27) — masked, never the full account number/phone (M27 §21). */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const view = await vendorFinanceService.getPayoutDestinationForVendor(context.vendorId);
  return apiSuccess(toPayoutDestinationDTO(view));
}

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("MOBILE_MONEY"),
    momoAccountName: z.string().trim().min(1),
    momoPhone: z.string().trim().min(9),
    momoNetwork: z.enum(["MTN", "TELECEL", "AT"]),
  }),
  z.object({
    type: z.literal("BANK_TRANSFER"),
    bankAccountName: z.string().trim().min(1),
    bankName: z.string().trim().min(1),
    bankAccountNumber: z.string().trim().min(1),
  }),
]);

/**
 * PATCH /api/v1/vendor/finance/payout-destination (M27) — OWNER-only,
 * enforced by vendorFinanceService itself (never trusted at the UI/route
 * layer — M27 §26). No automated "Withdraw": this only edits where a
 * future manual payout would be sent, matching the Paystack Starter
 * Business manual-fallback constraint (M27 §20/§21).
 */
export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Check the payout destination details.");

  const result = await vendorFinanceService.upsertPayoutDestinationForVendor(context.vendorId, context.role, session.user.id, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
