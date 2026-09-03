import { getCurrentSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { messagingService } from "../../../../modules/messaging/service";
import { parsePage } from "../../../../lib/pagination";
import { toConversationSummaryDTO } from "../../../../lib/api/dto/messaging";
import { apiError, apiPage, apiSuccess } from "../../../../lib/api/response";

const CONTEXT_TYPES = ["LISTING", "VENDOR", "ORDER", "SOURCING_REQUEST", "RESOLUTION_CASE"] as const;
type CustomerContextType = (typeof CONTEXT_TYPES)[number];

function isCustomerContextType(value: unknown): value is CustomerContextType {
  return typeof value === "string" && (CONTEXT_TYPES as readonly string[]).includes(value);
}

/**
 * GET /api/v1/messages (M30) — the signed-in customer's own CrownSource
 * conversations, newest-first, paginated. `?page=`. Thin route over the
 * EXISTING `messagingService.listForCustomer` — the same conversations
 * `app/(customer)/account/messages/page.tsx` already renders. No new
 * conversation concept, no unread state (the existing Conversation/Message
 * schema has no per-participant read tracking to expose).
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "A customer profile is required.");

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  const { rows, total, pageSize } = await messagingService.listForCustomer(customerProfile.id, page);
  return apiSuccess(apiPage({ rows: rows.map(toConversationSummaryDTO), total, page, pageSize }));
}

/**
 * POST /api/v1/messages (M30) — start or continue a contextual conversation
 * ("Ask about this item/vendor/order/sourcing request/case"), mirroring the
 * web `startContextualConversationAction` exactly via
 * `messagingService.startOrContinueContextual`. `contextRefId` is
 * re-validated against the caller's own ownership by that service (never
 * trusted as-is) — this route adds no authorization of its own.
 */
export async function POST(request: Request) {
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
  const { contextType, contextRefId, body } = (json ?? {}) as Record<string, unknown>;
  if (!isCustomerContextType(contextType)) return apiError("VALIDATION_ERROR", "Invalid conversation context.");
  if (typeof contextRefId !== "string" || !contextRefId) return apiError("VALIDATION_ERROR", "contextRefId is required.");
  if (typeof body !== "string" || !body.trim()) return apiError("VALIDATION_ERROR", "Write a message before sending.");

  const result = await messagingService.startOrContinueContextual({
    customerProfileId: customerProfile.id,
    senderUserId: session.user.id,
    contextType,
    contextRefId,
    body,
  });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess({ conversationId: result.value.conversationId });
}
