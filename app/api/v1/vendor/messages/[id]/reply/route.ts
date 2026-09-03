import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../lib/api/vendor-context";
import { messagingService } from "../../../../../../../modules/messaging/service";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";

type Params = { id: string };

/**
 * POST /api/v1/vendor/messages/:id/reply (M30) — reply to an existing
 * conversation as the owning vendor. Thin route over
 * `messagingService.replyAsVendor`, which re-verifies vendor ownership
 * before appending the message.
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const { body } = (json ?? {}) as Record<string, unknown>;
  if (typeof body !== "string" || !body.trim()) return apiError("VALIDATION_ERROR", "Write a message before sending.");

  const { id } = await params;
  const result = await messagingService.replyAsVendor(context.vendorId, session.user.id, id, body);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess({ sent: true });
}
