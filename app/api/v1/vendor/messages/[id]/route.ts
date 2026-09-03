import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { messagingService } from "../../../../../../modules/messaging/service";
import { toConversationDetailDTO } from "../../../../../../lib/api/dto/messaging";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/**
 * GET /api/v1/vendor/messages/:id (M30) — full conversation detail for the
 * owning vendor only. Reuses `messagingService.getForVendor` verbatim
 * (already scoped by `vendorId`) — another vendor's conversation or a
 * CUSTOMER-participant conversation both resolve to 404, never 403 (no
 * enumeration signal, same convention as every other `/api/v1/vendor/*`
 * detail route).
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;
  const conversation = await messagingService.getForVendor(context.vendorId, id);
  if (!conversation) return apiError("NOT_FOUND", "Conversation not found.");

  return apiSuccess(toConversationDetailDTO(conversation));
}
