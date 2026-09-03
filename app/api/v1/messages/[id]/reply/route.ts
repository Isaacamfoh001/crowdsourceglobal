import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../../modules/identity/policy";
import { messagingService } from "../../../../../../modules/messaging/service";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/**
 * POST /api/v1/messages/:id/reply (M30) — reply to an existing conversation
 * as the owning customer. Thin route over `messagingService.replyAsCustomer`,
 * which re-verifies ownership before appending the message (never trusts
 * the route to have already checked) and fires the same staff-attention
 * notification the web reply action triggers.
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "A customer profile is required.");

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const { body } = (json ?? {}) as Record<string, unknown>;
  if (typeof body !== "string" || !body.trim()) return apiError("VALIDATION_ERROR", "Write a message before sending.");

  const { id } = await params;
  const result = await messagingService.replyAsCustomer(customerProfile.id, session.user.id, id, body);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess({ sent: true });
}
