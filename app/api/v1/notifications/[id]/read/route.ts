import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { notificationsService } from "../../../../../../modules/notifications/service";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/**
 * POST /api/v1/notifications/:id/read (M28) — marks one notification read.
 * Ownership is enforced by `notificationsService.markRead` (id +
 * recipientUserId together); a notification that doesn't exist or belongs
 * to another user both resolve to 404 (anti-enumeration, same convention
 * as GET /api/v1/orders/:id). Idempotent — reading an already-read
 * notification is still a 200, not an error.
 */
export async function POST(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const { id } = await params;
  const result = await notificationsService.markRead(id, session.user.id);
  if (!result.ok) return apiError("NOT_FOUND", "Notification not found.");
  return apiSuccess({ read: true });
}
