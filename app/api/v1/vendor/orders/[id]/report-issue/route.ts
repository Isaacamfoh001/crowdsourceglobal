import { z } from "zod";
import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../lib/api/vendor-context";
import { fulfilmentService } from "../../../../../../../modules/fulfilment/service";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";

type Params = { id: string };
const schema = z.object({
  category: z.string().trim().min(2, "Choose an issue category."),
  description: z.string().trim().min(5, "Describe the issue in a bit more detail."),
});

/** POST /api/v1/vendor/orders/:id/report-issue (M27) — flips the fulfilment to EXCEPTION for CrownSource operations to resolve. */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
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
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check the issue details.");

  const result = await fulfilmentService.reportIssue(context.vendorId, id, session.user.id, parsed.data.category, parsed.data.description);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
