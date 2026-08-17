"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markNotificationReadAction } from "../../lib/actions/notifications";
import type { NotificationView } from "../../modules/notifications/types";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function NotificationRow({ notification }: { notification: NotificationView }) {
  const [, startTransition] = useTransition();

  function handleClick() {
    if (notification.readAt) return;
    const formData = new FormData();
    formData.set("id", notification.id);
    startTransition(() => {
      void markNotificationReadAction(null, formData);
    });
  }

  return (
    <Link
      href={notification.targetUrl}
      onClick={handleClick}
      className={`flex items-start gap-3 px-5 py-4 hover:bg-stone-50 ${notification.readAt ? "" : "bg-brand-50/40"}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.readAt ? "bg-transparent" : "bg-brand-600"}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${notification.readAt ? "font-medium text-stone-700" : "font-semibold text-stone-900"}`}>
          {notification.title}
          {!notification.readAt ? <span className="sr-only"> (unread)</span> : null}
        </p>
        <p className="mt-1 text-sm text-stone-600">{notification.body}</p>
        <p className="mt-1.5 text-xs text-stone-400">{formatDate(notification.createdAt)}</p>
      </div>
    </Link>
  );
}
