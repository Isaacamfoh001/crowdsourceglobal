import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../lib/api/vendor-context";
import { messagingService } from "../../../../../modules/messaging/service";
import { parsePage } from "../../../../../lib/pagination";
import { toConversationSummaryDTO } from "../../../../../lib/api/dto/messaging";
import { apiError, apiPage, apiSuccess } from "../../../../../lib/api/response";

/**
 * GET /api/v1/vendor/messages (M30) — this vendor's own CrownSource
 * conversations, newest-first, paginated. `?page=`. Thin route over the
 * EXISTING `messagingService.listForVendor` — the same conversations
 * `app/vendor/portal/messages/page.tsx` already renders.
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  const { rows, total, pageSize } = await messagingService.listForVendor(context.vendorId, page);
  return apiSuccess(apiPage({ rows: rows.map(toConversationSummaryDTO), total, page, pageSize }));
}

/**
 * POST /api/v1/vendor/messages (M30) — start a new conversation with
 * CrownSource. Two shapes, mirroring the two web entry points exactly:
 *  - `{ body }` — a general "Contact CrownSourceGlobal" message
 *    (`messagingService.startVendorConversation`, same as
 *    `StartVendorConversationForm`).
 *  - `{ contextResolutionCaseId, body }` — "Message CrownSourceGlobal"
 *    about a specific resolution case
 *    (`messagingService.startOrContinueVendorContextual`, same as
 *    `startVendorResolutionConversationAction`); that service re-verifies
 *    the case belongs to this vendor before attaching it.
 */
export async function POST(request: Request) {
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
  const { contextResolutionCaseId, body } = (json ?? {}) as Record<string, unknown>;
  if (typeof body !== "string" || !body.trim()) return apiError("VALIDATION_ERROR", "Write a message before sending.");

  const result =
    typeof contextResolutionCaseId === "string" && contextResolutionCaseId
      ? await messagingService.startOrContinueVendorContextual({
          vendorId: context.vendorId,
          senderUserId: session.user.id,
          contextResolutionCaseId,
          body,
        })
      : await messagingService.startVendorConversation(context.vendorId, session.user.id, body);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess({ conversationId: result.value.conversationId });
}
