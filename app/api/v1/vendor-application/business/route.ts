import { z } from "zod";
import { getCurrentSession } from "../../../../../modules/identity/policy";
import { vendorApplicationsService } from "../../../../../modules/vendor-applications/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

const schema = z.object({
  displayName: z.string().trim().min(2, "Enter your store or business name."),
  legalName: z.string().trim().optional(),
  storeDescription: z.string().trim().min(10, "Tell customers a little about your store."),
  registrationNumber: z.string().trim().optional(),
  taxIdentifier: z.string().trim().optional(),
  yearEstablished: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  websiteUrl: z.string().trim().optional(),
  country: z.string().trim().min(2, "Enter a country."),
  region: z.string().trim().min(2, "Enter a region."),
  city: z.string().trim().min(2, "Enter a city."),
  addressLine1: z.string().trim().min(3, "Enter an address."),
});

/** PATCH /api/v1/vendor-application/business (M27) — step 3, mirrors saveBusinessAction exactly. */
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
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check your business information.");

  const result = await vendorApplicationsService.saveBusiness(session.user.id, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
