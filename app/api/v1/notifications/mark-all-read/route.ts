import { getCurrentSession } from "../../../../../modules/identity/policy";
import { notificationsService } from "../../../../../modules/notifications/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

/** POST /api/v1/notifications/mark-all-read (M28) — marks every one of the signed-in user's unread notifications read. */
export async function POST(_request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  await notificationsService.markAllRead(session.user.id);
  return apiSuccess({ read: true });
}
