import { z } from "zod";
import { getCurrentSession } from "../../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../../lib/api/vendor-context";
import { beautyProfessionalsService } from "../../../../../../../../modules/beauty-professionals/service";
import { serviceRequestsService } from "../../../../../../../../modules/service-requests/service";
import { apiError, apiSuccess } from "../../../../../../../../lib/api/response";

type Params = { id: string };
const schema = z.object({ reason: z.string().trim().optional() });

/** POST /api/v1/vendor/beauty-professional/requests/:id/decline (M27). */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const profile = await beautyProfessionalsService.getForVendor(context.vendorId);
  if (!profile) return apiError("FORBIDDEN", "This vendor has no Beauty Professional profile.");

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // no body is fine — reason is optional
  }
  const parsed = schema.safeParse(body);
  const reason = parsed.success ? (parsed.data.reason ?? null) : null;

  const { id } = await params;
  const result = await serviceRequestsService.decline(profile.id, id, reason);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
