import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { notificationsService } from "./service";
import { notificationsRepository } from "./repository";
import { notificationLinks } from "./links";
import * as emailProviderModule from "../../lib/email-provider";
import { processEmailQueue } from "../../lib/email-worker";
import type { NotifyInput } from "./types";

/** Integration tests against the real local Postgres dev database. */
describe("notificationsService", () => {
  let userAId: string;
  let userAEmail: string;
  let userBId: string;
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userA = await prisma.user.create({
      data: { id: `notif-a-${suffix}`, name: "User A", email: `notif.a.${suffix}@example.com` },
    });
    userAId = userA.id;
    userAEmail = userA.email;
    createdUserIds.push(userA.id);

    const userB = await prisma.user.create({
      data: { id: `notif-b-${suffix}`, name: "User B", email: `notif.b.${suffix}@example.com` },
    });
    userBId = userB.id;
    createdUserIds.push(userB.id);
  });

  afterAll(async () => {
    // Cascades to Notification, EmailDeliveryJob, and NotificationPreference.
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  function eventKey() {
    return `test-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * This suite runs against the same shared dev Postgres database as every
   * other test file, all of which enqueue and drain real EmailDeliveryJob
   * rows concurrently. `claimNextJob` only looks at a 20-row candidate
   * batch per call, so a specific job can occasionally still be PENDING
   * after one drain call under heavy concurrent load. Poll a few times
   * rather than asserting after a single call.
   */
  async function waitForJobStatus(jobId: string, timeoutMs = 3000): Promise<{ status: string; attempts: number; lastError: string | null; availableAt: Date; sentAt: Date | null }> {
    const deadline = Date.now() + timeoutMs;
    let last = await prisma.emailDeliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    while (last.status === "PENDING" && Date.now() < deadline) {
      await processEmailQueue();
      last = await prisma.emailDeliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    }
    return last;
  }

  // ---- Creation -----------------------------------------------------

  it("creates an in-app notification with the given fields, unread by default", async () => {
    const key = eventKey();
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "ORDER_CONFIRMED",
      title: "Order confirmed",
      body: "Your order has been confirmed.",
      targetUrl: notificationLinks.customerOrder("order-1"),
      eventKey: key,
    });

    const { rows: list } = await notificationsService.listForUser(userAId);
    const found = list.find((n) => n.title === "Order confirmed");
    expect(found).toBeTruthy();
    expect(found?.readAt).toBeNull();
    expect(found?.targetUrl).toBe("/account/orders/order-1");
  });

  it("does not create a duplicate notification for the same recipient + eventKey (dedup)", async () => {
    const key = eventKey();
    const input: NotifyInput = {
      recipientUserId: userAId,
      type: "QUOTE_ISSUED",
      title: "Quote issued",
      body: "Your quote is ready.",
      targetUrl: notificationLinks.customerQuote("quote-1"),
      eventKey: key,
    };

    await notificationsService.notify(input);
    await notificationsService.notify(input); // retried callback / duplicate webhook
    await notificationsService.notify(input);

    const rows = await prisma.notification.findMany({ where: { recipientUserId: userAId, eventKey: key } });
    expect(rows).toHaveLength(1);
  });

  it("scopes the dedup key per recipient — two different users can each get their own row for the same logical event", async () => {
    const key = eventKey();
    const input = (recipientUserId: string): NotifyInput => ({
      recipientUserId,
      type: "ADMIN_NEW_MESSAGE",
      title: "New message needs a reply",
      body: "A customer sent a new message.",
      targetUrl: notificationLinks.adminMessage("conv-1"),
      eventKey: key,
    });

    await notificationsService.notify(input(userAId));
    await notificationsService.notify(input(userBId));

    const rowA = await prisma.notification.findFirst({ where: { recipientUserId: userAId, eventKey: key } });
    const rowB = await prisma.notification.findFirst({ where: { recipientUserId: userBId, eventKey: key } });
    expect(rowA).not.toBeNull();
    expect(rowB).not.toBeNull();
    expect(rowA?.id).not.toBe(rowB?.id);
  });

  it("a user with multiple roles sees a single deduplicated stream — distinct role-specific events both appear, without collapsing into each other", async () => {
    // Simulates one User who is both a Customer and a Vendor owner: a
    // customer-facing event and a vendor-facing event both target the same
    // recipientUserId. They must both be visible (not deduplicated away —
    // they are genuinely different events), while a retried duplicate of
    // either individually still collapses to one row.
    const customerKey = eventKey();
    const vendorKey = eventKey();

    await notificationsService.notify({
      recipientUserId: userAId,
      type: "ORDER_CONFIRMED",
      title: "Your order is confirmed",
      body: "As a customer, your order was confirmed.",
      targetUrl: notificationLinks.customerOrder("order-9"),
      eventKey: customerKey,
    });
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "VENDOR_NEW_ORDER",
      title: "New order for your store",
      body: "As a vendor, you received a new order.",
      targetUrl: notificationLinks.vendorOrder("fulfilment-9"),
      eventKey: vendorKey,
    });

    const { rows: list } = await notificationsService.listForUser(userAId);
    expect(list.some((n) => n.title === "Your order is confirmed")).toBe(true);
    expect(list.some((n) => n.title === "New order for your store")).toBe(true);

    const customerRows = await prisma.notification.findMany({ where: { recipientUserId: userAId, eventKey: customerKey } });
    const vendorRows = await prisma.notification.findMany({ where: { recipientUserId: userAId, eventKey: vendorKey } });
    expect(customerRows).toHaveLength(1);
    expect(vendorRows).toHaveLength(1);
  });

  // ---- Read state -----------------------------------------------------

  it("markRead marks a notification read, and is idempotent on a second call", async () => {
    const key = eventKey();
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "DELIVERED",
      title: "Delivered",
      body: "Your order was delivered.",
      targetUrl: notificationLinks.customerOrder("order-2"),
      eventKey: key,
    });
    const notification = await prisma.notification.findFirst({ where: { recipientUserId: userAId, eventKey: key } });
    expect(notification).not.toBeNull();

    const first = await notificationsService.markRead(notification!.id, userAId);
    expect(first.ok).toBe(true);
    const afterFirst = await prisma.notification.findUnique({ where: { id: notification!.id } });
    expect(afterFirst?.readAt).not.toBeNull();

    const second = await notificationsService.markRead(notification!.id, userAId);
    expect(second.ok).toBe(true); // already-read is not an error
  });

  it("rejects marking read a notification that belongs to another user, and does not change its state", async () => {
    const key = eventKey();
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "OUT_FOR_DELIVERY",
      title: "Out for delivery",
      body: "Your order is out for delivery.",
      targetUrl: notificationLinks.customerOrder("order-3"),
      eventKey: key,
    });
    const notification = await prisma.notification.findFirst({ where: { recipientUserId: userAId, eventKey: key } });
    expect(notification).not.toBeNull();

    const result = await notificationsService.markRead(notification!.id, userBId);
    expect(result.ok).toBe(false); // userB does not own this notification

    const unchanged = await prisma.notification.findUnique({ where: { id: notification!.id } });
    expect(unchanged?.readAt).toBeNull();
  });

  it("markAllRead marks only the calling user's unread notifications, leaving other users' untouched", async () => {
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "PACKAGE_COLLECTED",
      title: "Collected 1",
      body: "Package collected.",
      targetUrl: notificationLinks.customerOrder("order-4"),
      eventKey: eventKey(),
    });
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "PACKAGE_COLLECTED",
      title: "Collected 2",
      body: "Package collected.",
      targetUrl: notificationLinks.customerOrder("order-5"),
      eventKey: eventKey(),
    });
    await notificationsService.notify({
      recipientUserId: userBId,
      type: "PACKAGE_COLLECTED",
      title: "Collected B",
      body: "Package collected.",
      targetUrl: notificationLinks.customerOrder("order-6"),
      eventKey: eventKey(),
    });

    const result = await notificationsService.markAllRead(userAId);
    expect(result.ok).toBe(true);

    const unreadA = await prisma.notification.count({ where: { recipientUserId: userAId, readAt: null } });
    const unreadB = await prisma.notification.count({ where: { recipientUserId: userBId, readAt: null } });
    expect(unreadA).toBe(0);
    expect(unreadB).toBeGreaterThan(0); // userA's mark-all-read must not leak into userB
  });

  // ---- Unread count / bell data ---------------------------------------

  it("getUnreadCount and getBellData are scoped per user and reflect read state", async () => {
    const key1 = eventKey();
    const key2 = eventKey();
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "COLLECTION_SCHEDULED",
      title: "Scheduled 1",
      body: "Collection scheduled.",
      targetUrl: notificationLinks.customerOrder("order-7"),
      eventKey: key1,
    });
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "COLLECTION_SCHEDULED",
      title: "Scheduled 2",
      body: "Collection scheduled.",
      targetUrl: notificationLinks.customerOrder("order-8"),
      eventKey: key2,
    });

    const before = await notificationsService.getUnreadCount(userAId);
    const bell = await notificationsService.getBellData(userAId);
    expect(bell.unreadCount).toBe(before);
    expect(bell.recent.length).toBeGreaterThanOrEqual(2);
    expect(bell.recent[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(bell.recent[bell.recent.length - 1]!.createdAt.getTime());

    const notification = await prisma.notification.findFirst({ where: { recipientUserId: userAId, eventKey: key1 } });
    await notificationsService.markRead(notification!.id, userAId);

    const after = await notificationsService.getUnreadCount(userAId);
    expect(after).toBe(before - 1);
  });

  it("a user's notification list never includes another user's notifications", async () => {
    await notificationsService.notify({
      recipientUserId: userBId,
      type: "FULFILMENT_ISSUE_RESOLVED",
      title: "Only for B",
      body: "This belongs to userB only.",
      targetUrl: notificationLinks.customerOrder("order-only-b"),
      eventKey: eventKey(),
    });

    const { rows: listA } = await notificationsService.listForUser(userAId);
    expect(listA.some((n) => n.title === "Only for B")).toBe(false);
  });

  // ---- Preferences / email gating --------------------------------------

  it("a REQUIRED notification type queues an email even when the recipient has disabled its category", async () => {
    await notificationsService.updatePreferences(userAId, { ordersDeliveryEmail: false });

    const key = eventKey();
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "ORDER_CONFIRMED", // REQUIRED, per policy.ts
      title: "Order confirmed",
      body: "Your order has been confirmed.",
      targetUrl: notificationLinks.customerOrder("order-required"),
      eventKey: key,
      email: { to: userAEmail, subject: "Order confirmed", templateKey: "order-confirmed", templateData: {} },
    });

    const notification = await prisma.notification.findFirst({ where: { recipientUserId: userAId, eventKey: key } });
    const job = await prisma.emailDeliveryJob.findFirst({ where: { notificationId: notification!.id } });
    expect(job).not.toBeNull();
    expect(job?.to).toBe(userAEmail);
  });

  it("an OPTIONAL notification type does not queue an email when the recipient has disabled its category, but the in-app notification still persists", async () => {
    await notificationsService.updatePreferences(userAId, { ordersDeliveryEmail: false });

    const key = eventKey();
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "VENDOR_NEW_ORDER", // OPTIONAL / ORDERS_DELIVERY, per policy.ts
      title: "New order",
      body: "You have a new order.",
      targetUrl: notificationLinks.vendorOrder("fulfilment-optional"),
      eventKey: key,
      email: { to: userAEmail, subject: "New order", templateKey: "vendor-new-order", templateData: {} },
    });

    const notification = await prisma.notification.findFirst({ where: { recipientUserId: userAId, eventKey: key } });
    expect(notification).not.toBeNull(); // in-app is never gated by preference
    const job = await prisma.emailDeliveryJob.findFirst({ where: { notificationId: notification!.id } });
    expect(job).toBeNull(); // but the optional email is suppressed
  });

  it("an OPTIONAL notification type queues an email when its category is enabled (the default)", async () => {
    const key = eventKey();
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "SOURCING_QUOTE_READY", // OPTIONAL / QUOTATIONS_SOURCING
      title: "Your custom quote is ready",
      body: "We have a quote for your sourcing request.",
      targetUrl: notificationLinks.customerSourcing("req-1"),
      eventKey: key,
      email: { to: userAEmail, subject: "Your quote is ready", templateKey: "sourcing-quote-ready", templateData: {} },
    });

    const notification = await prisma.notification.findFirst({ where: { recipientUserId: userAId, eventKey: key } });
    const job = await prisma.emailDeliveryJob.findFirst({ where: { notificationId: notification!.id } });
    expect(job).not.toBeNull();
  });

  it("updatePreferences persists per-category choices independently, and getPreferences reflects them", async () => {
    const updated = await notificationsService.updatePreferences(userAId, { messagesEmail: false });
    expect(updated.ok).toBe(true);

    const preferences = await notificationsService.getPreferences(userAId);
    expect(preferences.messagesEmail).toBe(false);
    expect(preferences.ordersDeliveryEmail).toBe(true); // untouched fields keep their default
    expect(preferences.quotationsSourcingEmail).toBe(true);
  });

  // ---- Email delivery / retry ------------------------------------------

  it("processEmailQueue sends a queued job through the configured provider and marks it SENT", async () => {
    const key = eventKey();
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "DELIVERED",
      title: "Delivered",
      body: "Your order was delivered.",
      targetUrl: notificationLinks.customerOrder("order-sent"),
      eventKey: key,
      email: { to: userAEmail, subject: "Delivered", templateKey: "delivered", templateData: {} },
    });
    const notification = await prisma.notification.findFirst({ where: { recipientUserId: userAId, eventKey: key } });
    const job = await prisma.emailDeliveryJob.findFirst({ where: { notificationId: notification!.id } });
    const settled = await waitForJobStatus(job!.id);
    expect(settled.status).toBe("SENT");
    expect(settled.sentAt).not.toBeNull();
  });

  it("a failing provider does not affect the in-app notification, which persists independently of email outcome", async () => {
    // This suite shares one Postgres EmailDeliveryJob queue with every
    // other test file, and claimNextJob() claims whatever's next
    // globally — another file's own (unmocked) drain can legitimately
    // claim and successfully send this exact job before this test's own
    // drain call does. So this test (like the equivalent "does not roll
    // back" tests in the other M0-M6 service test files) only asserts the
    // one thing that's actually deterministic here: notification
    // persistence never depends on the email provider's outcome. The
    // FAILED-status/backoff mechanics themselves are covered directly,
    // without going through the contended shared queue, below.
    //
    // Rejects only the *next* call (not persistently): processEmailQueue()
    // drains up to 50 eligible jobs per call from the whole shared table,
    // not just this test's own — a persistent rejection would fail every
    // other test file's concurrently-pending job it happens to also pick
    // up in the same drain, not just this one.
    const spy = vi.spyOn(emailProviderModule.emailProvider, "send").mockRejectedValueOnce(new Error("simulated outage"));

    const key = eventKey();
    await notificationsService.notify({
      recipientUserId: userAId,
      type: "DELIVERY_ISSUE",
      title: "Delivery issue",
      body: "There was an issue with your delivery.",
      targetUrl: notificationLinks.customerOrder("order-fail"),
      eventKey: key,
      email: { to: userAEmail, subject: "Delivery issue", templateKey: "delivery-issue", templateData: {} },
    });
    await processEmailQueue();

    const notification = await prisma.notification.findFirst({ where: { recipientUserId: userAId, eventKey: key } });
    expect(notification).not.toBeNull();

    spy.mockRestore();
  });

  it("markJobFailed records the error and schedules a future retry", async () => {
    const key = eventKey();
    // No email payload here (see the exhausted-attempts test above for why):
    // the job row is inserted directly, already parked with a far-future
    // availableAt, so it's never eligible for any concurrent drain — from
    // this test's own notify() kick or another test file's — to claim and
    // mutate before markJobFailed runs below.
    const notification = await notificationsRepository.create({
      recipientUserId: userAId,
      type: "DELIVERY_ISSUE",
      title: "Delivery issue",
      body: "There was an issue with your delivery.",
      targetUrl: notificationLinks.customerOrder("order-retry"),
      eventKey: key,
    });
    expect(notification).not.toBeNull();
    const job = await prisma.emailDeliveryJob.create({
      data: {
        notificationId: notification!.id,
        to: userAEmail,
        subject: "Delivery issue",
        templateKey: "delivery-issue",
        templateData: {},
        availableAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    const retryAt = new Date(Date.now() + 5 * 60_000);
    await notificationsRepository.markJobFailed(job.id, "simulated outage", retryAt);

    const updated = await prisma.emailDeliveryJob.findUnique({ where: { id: job.id } });
    expect(updated?.status).toBe("FAILED");
    expect(updated?.lastError).toBe("simulated outage");
    expect(updated?.availableAt.getTime()).toBe(retryAt.getTime());
  });

  it("stops retrying a job once it has exhausted its maxAttempts", async () => {
    const key = eventKey();
    // The Notification is created without an email payload, and the
    // EmailDeliveryJob is inserted separately, already attempts=maxAttempts
    // and status=FAILED — i.e. it is *never* PENDING/eligible at any point.
    // Creating it eligible first and then updating it to exhausted (as an
    // earlier version of this test did) leaves a real window where a
    // concurrent drain from another test file — this suite shares one
    // Postgres job queue across every test file — can claim and complete
    // it with its own unmocked provider before the update lands, and that
    // claim's own markJobSent() write can land *after* the update,
    // clobbering it back to SENT. Never exposing an eligible row at all
    // removes the race entirely rather than racing to win it.
    const notification = await notificationsRepository.create({
      recipientUserId: userAId,
      type: "DELIVERY_ISSUE",
      title: "Delivery issue",
      body: "There was an issue with your delivery.",
      targetUrl: notificationLinks.customerOrder("order-exhausted"),
      eventKey: key,
    });
    expect(notification).not.toBeNull();
    const maxAttempts = 5;
    const job = await prisma.emailDeliveryJob.create({
      data: {
        notificationId: notification!.id,
        to: userAEmail,
        subject: "Delivery issue",
        templateKey: "delivery-issue",
        templateData: {},
        attempts: maxAttempts,
        maxAttempts,
        status: "FAILED",
      },
    });

    await processEmailQueue();
    const afterDrain = await prisma.emailDeliveryJob.findUnique({ where: { id: job.id } });
    expect(afterDrain?.status).toBe("FAILED");
    expect(afterDrain?.attempts).toBe(maxAttempts); // never reclaimed
  });
});
