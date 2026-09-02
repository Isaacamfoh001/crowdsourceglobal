import { z } from "zod";
import { getCurrentSession } from "../../../../../modules/identity/policy";
import { vendorApplicationsService } from "../../../../../modules/vendor-applications/service";
import { SELLER_TYPES } from "../../../../../modules/vendor-applications/types";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

const sellerTypeValues = SELLER_TYPES.map((t) => t.value) as [string, ...string[]];
const schema = z.object({ sellerType: z.enum(sellerTypeValues) });

/** PATCH /api/v1/vendor-application/seller-type (M27) — step 1, mirrors saveSellerTypeAction exactly. JSON body: { sellerType }. */
export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Choose how you sell.");

  const result = await vendorApplicationsService.saveSellerType(session.user.id, { sellerType: parsed.data.sellerType as never });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
