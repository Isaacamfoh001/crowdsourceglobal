import { notificationsRepository } from "./repository";
import { shouldSendEmail, shouldSendPush } from "./policy";
import { processEmailQueue } from "../../lib/email-worker";
import { ok, err, type Result } from "../../lib/result";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import type { NotifyInput, NotificationView, PreferencesView, PreferencesInput, RegisterDeviceInput } from "./types";

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
   * do), a durable EmailDeliveryJob in the same transaction — plus, if
   * `shouldSendPush(input.type)` says this type is push-worthy (M31), a
   * durable PushDeliveryJob in that same transaction too. Both channels are
   * strictly additive on top of the Notification write: a failure in
   * either never rolls back or blocks the in-app notification, which
   * remains the source of truth regardless of delivery outcome.
   *
   * Only email gets the fire-and-forget `processEmailQueue()` dev-
   * convenience kick here. Push deliberately does not: receiving a real
   * push requires a physical device + a dev build regardless of what runs
   * locally (Expo Go cannot receive one — see M31's audit), so there is no
   * "arrives instantly with zero setup" win to preserve the way there is
   * for a console-logged verification email link. Draining
   * PushDeliveryJob is `processPushQueue()` (lib/push-worker.ts), run on a
   * schedule via `npm run jobs:push` — same production-appropriate,
   * durable-job-row-is-the-source-of-truth pattern `jobs:email` already
   * uses, just without an extra always-on background query added to every
   * single `notify()` call in the app.
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

      await notificationsRepository.create({ ...input, email }, shouldSendPush(input.type));
      void processEmailQueue();
    } catch (error) {
      console.error("Notification dispatch failed:", error);
    }
  },

  async listForUser(userId: string, page = 1): Promise<{ rows: NotificationView[]; total: number; pageSize: number }> {
    const { rows, total } = await notificationsRepository.listForUserPaginated(userId, page, DEFAULT_PAGE_SIZE);
    return { rows: rows.map(toView), total, pageSize: DEFAULT_PAGE_SIZE };
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

  // --- Push devices (M31) --------------------------------------------------

  /**
   * Registers (or re-registers) the calling user's own device for push —
   * called right after sign-in and on every cold start while signed in,
   * mirroring the token-refresh guidance in Expo's push docs. `userId`
   * always comes from the caller's own session (see the API route), never
   * from the request body — a client can only ever register a device for
   * itself. Upserting on `expoPushToken` (not a composite key) is what
   * makes signing in as a different person on the same device correctly
   * reassign that device's future pushes — see PushDevice's schema doc
   * comment.
   */
  async registerDevice(userId: string, input: RegisterDeviceInput): Promise<Result<null>> {
    if (!input.expoPushToken.trim()) return err("A push token is required.");
    await notificationsRepository.upsertDevice(userId, input);
    return ok(null);
  },

  /**
   * Unregisters one of the calling user's own devices — called on sign-out
   * so a device stops receiving that account's pushes the moment the user
   * signs out of it (M31 §11's privacy boundary). Scoped by `userId` in
   * the repository, so a token that isn't currently this user's own is
   * left untouched rather than removed out from under whoever it actually
   * belongs to.
   */
  async unregisterDevice(userId: string, expoPushToken: string): Promise<Result<null>> {
    await notificationsRepository.removeDevice(userId, expoPushToken);
    return ok(null);
  },
};
