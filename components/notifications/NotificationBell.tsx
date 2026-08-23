"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markNotificationReadAction, markAllNotificationsReadAction } from "../../lib/actions/notifications";
import type { NotificationView } from "../../modules/notifications/types";

/**
 * Rendered once per header shell (public/account/vendor-portal/admin — the
 * app has no single shared layout to hook into once) but always reads from
 * the same Notification table via notificationsService.getBellData, so a
 * multi-role User sees one consistent, deduplicated stream everywhere.
 * Server-authoritative: unreadCount/recent come from the enclosing Server
 * Component layout at request time — no client polling, no WebSocket (M7
 * deliberately stays non-realtime; see docs/architecture/overview.md).
 */
export function NotificationBell({
  unreadCount,
  recent,
  onDark = false,
}: {
  unreadCount: number;
  recent: NotificationView[];
  /** For the admin header's dark background — only affects the bell button, never the (always-light) dropdown panel. */
  onDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function markReadInBackground(id: string, readAt: Date | null) {
    if (readAt) return;
    const formData = new FormData();
    formData.set("id", id);
    startTransition(() => {
      void markNotificationReadAction(null, formData);
    });
  }

  function handleMarkAllRead() {
    startTransition(() => {
      void markAllNotificationsReadAction(null, new FormData());
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className={`relative flex size-10 items-center justify-center rounded-lg transition-colors ${
          onDark ? "text-ivory-200/70 hover:bg-white/10 hover:text-ivory-50" : "text-espresso-800 hover:bg-ivory-100"
        }`}
      >
        <Bell className="size-5" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-forest-800 text-[10px] font-semibold text-ivory-50"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* Click-outside dismiss layer. */}
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-ivory-300 bg-white shadow-lifted sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-ivory-200 px-4 py-3">
              <p className="text-sm font-semibold text-espresso-950">Notifications</p>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs font-medium text-forest-800 hover:underline"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {recent.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-espresso-900/55">You&apos;re all caught up.</p>
              ) : (
                recent.map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.targetUrl}
                    onClick={() => {
                      markReadInBackground(notification.id, notification.readAt);
                      setOpen(false);
                    }}
                    className={`block border-b border-ivory-100 px-4 py-3 last:border-0 hover:bg-ivory-50 ${
                      notification.readAt ? "" : "bg-champagne-200/20"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${notification.readAt ? "bg-transparent" : "bg-champagne-600"}`}
                      />
                      <div className="min-w-0">
                        <p className={`text-sm ${notification.readAt ? "font-medium text-espresso-800" : "font-semibold text-espresso-950"}`}>
                          {notification.title}
                          {!notification.readAt ? <span className="sr-only"> (unread)</span> : null}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-espresso-900/55">{notification.body}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="border-t border-ivory-200 px-4 py-2.5 text-center">
              <Link
                href="/account/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-forest-800 hover:underline"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
