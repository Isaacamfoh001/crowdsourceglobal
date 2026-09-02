import { z } from "zod";
import { getCurrentSession } from "../../../../../modules/identity/policy";
import { vendorApplicationsService } from "../../../../../modules/vendor-applications/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

const schema = z.object({
  categorySlugs: z.array(z.string()).min(1, "Choose at least one category."),
  sellingMode: z.enum(["retail", "wholesale", "both"]),
  bulkCapable: z.boolean(),
  leadTimeDaysDefault: z.coerce.number().int().min(0).optional(),
  serviceAreas: z.string().trim().optional(),
});

/** PATCH /api/v1/vendor-application/operations (M27) — step 4, mirrors saveOperationsAction exactly. */
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
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check what you sell.");

  const result = await vendorApplicationsService.saveOperations(session.user.id, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
