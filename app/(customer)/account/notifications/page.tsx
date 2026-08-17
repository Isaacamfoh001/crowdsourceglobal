import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { MarkAllReadButton } from "../../../../components/notifications/MarkAllReadButton";
import { NotificationRow } from "../../../../components/notifications/NotificationRow";
import { requireSession } from "../../../../modules/identity/policy";
import { notificationsService } from "../../../../modules/notifications/service";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await requireSession("/account/notifications");
  const notifications = await notificationsService.listForUser(session.user.id);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">Notifications</h1>
          <p className="mt-1 text-sm text-stone-500">
            Updates about your orders, quotes, sourcing requests, vendor account, and messages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/account/notifications/preferences"
            className="text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            Preferences
          </Link>
          {unreadCount > 0 ? <MarkAllReadButton /> : null}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <CheckCheck className="mx-auto size-8 text-stone-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-stone-500">You&apos;re all caught up — no notifications yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
