import { notificationsRepository } from "./repository";
import { shouldSendEmail } from "./policy";
import { processEmailQueue } from "../../lib/email-worker";
import { ok, err, type Result } from "../../lib/result";
import type { NotifyInput, NotificationView, PreferencesView, PreferencesInput } from "./types";

function toView(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string;
  readAt: Date | null;
  createdAt: Date;
}): NotificationView {
  return {
    id: row.id,
    type: row.type as NotificationView["type"],
    title: row.title,
    body: row.body,
    targetUrl: row.targetUrl,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

const DEFAULT_PREFERENCES: PreferencesView = {
  ordersDeliveryEmail: true,
  quotationsSourcingEmail: true,
  messagesEmail: true,
};

export const notificationsService = {
  /**
   * The single entry point every domain module calls post-commit, in place
   * of the old direct `notifySafely(() => sendXEmail(...))` pattern. Always
   * safe to await: internally try/catches so a notifications-table hiccup
   * can never propagate into (or appear to invalidate) an already-committed
   * domain transition — the exact same guarantee the old pattern gave for
   * email-provider failures, now extended to notification persistence too.
   *
   * Creates the Notification (in-app, always) and, only if `input.email` is
   * present AND the recipient's preference allows it (REQUIRED types always
   * do), a durable EmailDeliveryJob in the same transaction. Actual email
   * *sending* is fire-and-forget from here — `processEmailQueue()` is a
   * dev-convenience drain, never the source of delivery correctness; the
   * persisted job row is.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      let email = input.email;
      if (email) {
        const preferences = (await notificationsRepository.findPreferences(input.recipientUserId)) ?? DEFAULT_PREFERENCES;
        if (!shouldSendEmail(input.type, preferences)) {
          email = undefined;
        }
      }

      await notificationsRepository.create({ ...input, email });
      void processEmailQueue();
    } catch (error) {
      console.error("Notification dispatch failed:", error);
    }
  },

  async listForUser(userId: string): Promise<NotificationView[]> {
    const rows = await notificationsRepository.listForUser(userId);
    return rows.map(toView);
  },

  getUnreadCount(userId: string): Promise<number> {
    return notificationsRepository.countUnread(userId);
  },

  /** One combined fetch for the notification bell — avoids duplicating two separate queries across the four header shells (public/account/vendor/admin) that each render it. */
  async getBellData(userId: string): Promise<{ unreadCount: number; recent: NotificationView[] }> {
    const [unreadCount, rows] = await Promise.all([
      notificationsRepository.countUnread(userId),
      notificationsRepository.listForUser(userId, 8),
    ]);
    return { unreadCount, recent: rows.map(toView) };
  },

  async markRead(id: string, userId: string): Promise<Result<null>> {
    const applied = await notificationsRepository.markRead(id, userId);
    if (!applied) {
      // Either it doesn't belong to this user, or it was already read —
      // either way there is nothing unsafe to report back generically.
      const owned = await notificationsRepository.findByIdForUser(id, userId);
      if (!owned) return err("Notification not found.");
    }
    return ok(null);
  },

  async markAllRead(userId: string): Promise<Result<null>> {
    await notificationsRepository.markAllRead(userId);
    return ok(null);
  },

  async getPreferences(userId: string): Promise<PreferencesView> {
    const row = await notificationsRepository.findPreferences(userId);
    return row
      ? { ordersDeliveryEmail: row.ordersDeliveryEmail, quotationsSourcingEmail: row.quotationsSourcingEmail, messagesEmail: row.messagesEmail }
      : DEFAULT_PREFERENCES;
  },

  async updatePreferences(userId: string, input: PreferencesInput): Promise<Result<PreferencesView>> {
    const row = await notificationsRepository.upsertPreferences(userId, input);
    return ok({ ordersDeliveryEmail: row.ordersDeliveryEmail, quotationsSourcingEmail: row.quotationsSourcingEmail, messagesEmail: row.messagesEmail });
  },
};
