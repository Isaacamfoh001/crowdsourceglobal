import { z } from "zod";
import { getCurrentSession } from "../../../../../modules/identity/policy";
import { vendorApplicationsService } from "../../../../../modules/vendor-applications/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

const schema = z.object({
  contactName: z.string().trim().min(2, "Enter your name."),
  contactEmail: z.email("Enter a valid email address."),
  contactPhone: z.string().trim().min(9, "Enter a valid phone number."),
});

/** PATCH /api/v1/vendor-application/contact (M27) — step 2, mirrors saveContactAction exactly. */
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
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check your contact details.");

  const result = await vendorApplicationsService.saveContact(session.user.id, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
