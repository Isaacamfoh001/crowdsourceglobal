import { getCurrentSession } from "../../../../modules/identity/policy";
import { notificationsService } from "../../../../modules/notifications/service";
import { parsePage } from "../../../../lib/pagination";
import { toNotificationDTO } from "../../../../lib/api/dto/notifications";
import { apiError, apiPage, apiSuccess } from "../../../../lib/api/response";

/**
 * GET /api/v1/notifications (M28) — the signed-in user's own notification
 * inbox, newest-first, page-paginated. `?page=`. Same `notificationsService`
 * the web account/notifications page already renders from — no parallel
 * notification concept, no business logic duplicated here.
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  const { rows, total, pageSize } = await notificationsService.listForUser(session.user.id, page);
  return apiSuccess(apiPage({ rows: rows.map(toNotificationDTO), total, page, pageSize }));
}
