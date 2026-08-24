import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { MarkAllReadButton } from "../../../../components/notifications/MarkAllReadButton";
import { NotificationRow } from "../../../../components/notifications/NotificationRow";
import { Pagination } from "../../../../components/shared/Pagination";
import { requireSession } from "../../../../modules/identity/policy";
import { notificationsService } from "../../../../modules/notifications/service";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireSession("/account/notifications");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: notifications, total, pageSize } = await notificationsService.listForUser(session.user.id, currentPage);
  // Site-wide unread count, not just this page's rows — pagination must not
  // hide the "mark all read" action when unread notifications exist on
  // other pages.
  const unreadCount = await notificationsService.getUnreadCount(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-espresso-950">Notifications</h1>
          <p className="mt-1 text-sm text-espresso-900/50">
            Updates about your orders, quotes, sourcing requests, vendor account, and messages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/account/notifications/preferences"
            className="text-sm font-medium text-espresso-900/65 hover:text-espresso-950"
          >
            Preferences
          </Link>
          {unreadCount > 0 ? <MarkAllReadButton /> : null}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ivory-400 bg-ivory-50 p-10 text-center">
          <CheckCheck className="mx-auto size-8 text-ivory-400" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-espresso-900/50">You&apos;re all caught up — no notifications yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-ivory-200 border-t border-ivory-300">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/account/notifications" />
    </div>
  );
}
