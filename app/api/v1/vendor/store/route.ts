import { z } from "zod";
import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../lib/api/vendor-context";
import { vendorsService } from "../../../../../modules/vendors/service";
import { toVendorStoreProfileDTO } from "../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

/** GET /api/v1/vendor/store (M27) — the vendor's own store/settings profile (M27 §6/§24). */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const profile = await vendorsService.getStoreProfile(context.vendorId);
  if (!profile) return apiError("NOT_FOUND", "Store not found.");
  return apiSuccess(toVendorStoreProfileDTO(profile));
}

const schema = z.object({
  companyName: z.string().trim().min(2, "Enter a store name."),
  description: z.string().trim().optional(),
  country: z.string().trim().optional(),
  region: z.string().trim().optional(),
  city: z.string().trim().optional(),
  categorySlugs: z.array(z.string()),
  contactEmail: z.email().optional(),
  contactPhone: z.string().trim().optional(),
  leadTimeDaysDefault: z.coerce.number().int().min(0).optional(),
  pickupAddressLine1: z.string().trim().optional(),
  pickupContactName: z.string().trim().optional(),
  pickupContactPhone: z.string().trim().optional(),
  pickupHours: z.string().trim().optional(),
  pickupNotes: z.string().trim().optional(),
});

/** PATCH /api/v1/vendor/store (M27) — edit store settings, mirrors the web Vendor Portal's store-profile form fields exactly. */
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
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check your store details.");

  const result = await vendorsService.updateStoreProfile(context.vendorId, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
