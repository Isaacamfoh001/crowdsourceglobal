import { z } from "zod";
import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { identityService } from "../../../../../modules/identity/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

const schema = z.object({
  preferredExperience: z.enum(["BUYER", "SELLER", "FACTORY", "BEAUTY"]).nullable(),
});

/**
 * PATCH /api/v1/me/experience (M32.3) — persists the mobile app's
 * "Experience Mode" chooser/switcher selection for a signed-in user, so it
 * survives a reinstall/new device. Purely a UI preference on
 * `CustomerProfile.preferredExperience` — this route makes no authorization
 * decision and never checks whether the caller actually has a matching
 * `VendorMembership`; every `/api/v1/vendor/*` route keeps deriving its own
 * vendor context independently, exactly as before this field existed.
 */
export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts have an experience preference.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Choose a valid experience.");

  await identityService.updatePreferredExperience(session.user.id, parsed.data.preferredExperience);
  return apiSuccess(null);
}
