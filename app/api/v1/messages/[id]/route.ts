import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { messagingService } from "../../../../../modules/messaging/service";
import { toConversationDetailDTO } from "../../../../../lib/api/dto/messaging";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

type Params = { id: string };

/**
 * GET /api/v1/messages/:id (M30) — full conversation detail (every message,
 * chronological) for the owning customer only. Reuses
 * `messagingService.getForCustomer` verbatim, which already scopes by
 * `customerProfileId` — a conversation belonging to another customer or a
 * VENDOR-participant conversation both resolve to 404 (anti-enumeration,
 * same convention as GET /api/v1/resolutions/:id). No message-level
 * pagination: the existing web thread view loads the whole history in one
 * query, and operational-support threads are short enough that mirroring
 * that (rather than inventing a new paginated-messages contract the
 * backend doesn't have) is the right call for V1.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("NOT_FOUND", "Conversation not found.");

  const { id } = await params;
  const conversation = await messagingService.getForCustomer(customerProfile.id, id);
  if (!conversation) return apiError("NOT_FOUND", "Conversation not found.");

  return apiSuccess(toConversationDetailDTO(conversation));
}
