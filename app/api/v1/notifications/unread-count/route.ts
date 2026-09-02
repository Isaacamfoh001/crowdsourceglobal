import { getCurrentSession } from "../../../../../modules/identity/policy";
import { notificationsService } from "../../../../../modules/notifications/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

/**
 * GET /api/v1/notifications/unread-count (M28) — cheap count for the Home
 * bell badge. Deliberately a separate route from the paginated list so the
 * bell (polled far more often than the inbox is opened) never has to fetch
 * a page of rows just to render a number.
 */
export async function GET(_request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const unreadCount = await notificationsService.getUnreadCount(session.user.id);
  return apiSuccess({ unreadCount });
}
