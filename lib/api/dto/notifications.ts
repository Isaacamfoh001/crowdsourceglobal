import { serializeDate } from "../response";
import type { NotificationView } from "../../../modules/notifications/types";

/**
 * `GET /api/v1/notifications` row / `unread-count`/`read`/`mark-all-read`
 * mutation echo (M28) — mirrors NotificationView exactly. `targetUrl` is
 * carried through as-is (the same app-relative web path
 * modules/notifications/links.ts already builds) so the mobile client can
 * derive its own native destination from it; it is never itself pushed as
 * an Expo Router path (see mobile's src/features/notifications/destination.ts).
 */
export function toNotificationDTO(notification: NotificationView) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    targetUrl: notification.targetUrl,
    readAt: notification.readAt ? serializeDate(notification.readAt) : null,
    createdAt: serializeDate(notification.createdAt),
  };
}
