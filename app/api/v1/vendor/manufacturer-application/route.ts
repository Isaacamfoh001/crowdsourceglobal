import { z } from "zod";
import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../lib/api/vendor-context";
import { manufacturerApplicationsService } from "../../../../../modules/manufacturer-applications/service";
import { toManufacturerApplicationDTO } from "../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

const schema = z.object({
  categorySlugs: z.array(z.string()),
  // "Other / Not listed": free-text, never written into categorySlugs — same
  // mutual-exclusivity rule as vendor-application/operations (M32.3).
  categoryOther: z.string().trim().max(200).optional(),
});

/** GET /api/v1/vendor/manufacturer-application (M32.8) — this vendor's Seller → Manufacturer upgrade request, or null if they haven't applied. */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const application = await manufacturerApplicationsService.getForVendor(context.vendorId);
  return apiSuccess(application ? toManufacturerApplicationDTO(application) : null);
}

/**
 * PATCH /api/v1/vendor/manufacturer-application (M32.8) — submit (first
 * time) or edit-and-resubmit (after CHANGES_REQUESTED/REJECTED) the short
 * manufacturer upgrade application. JSON body: { categorySlugs, categoryOther? }.
 * A single short step, not a wizard — no separate draft-save endpoint.
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
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Tell us what you manufacture.");

  const result = await manufacturerApplicationsService.submitOrUpdate(context.vendorId, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(result.value);
}
