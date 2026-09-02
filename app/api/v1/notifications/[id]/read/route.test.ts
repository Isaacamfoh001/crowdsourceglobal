// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";
import { notificationsService } from "../../../../../../modules/notifications/service";
import { notificationLinks } from "../../../../../../modules/notifications/links";

vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(user: { id: string; email: string; name: string }): Session {
  return {
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId: user.id, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function eventKey() {
  return `test-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function callPost(id: string) {
  return POST(new Request(`http://localhost/api/v1/notifications/${id}/read`, { method: "POST" }), { params: Promise.resolve({ id }) });
}

describe("POST /api/v1/notifications/:id/read (M28)", () => {
  const createdUserIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeUser(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `notif-read-${label}-${suffix}`, name: `Notif Read ${label}`, email: `notif.read.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    return user;
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await callPost("nonexistent-id");
    expect(response.status).toBe(401);
  });

  it("marks the caller's own notification read", async () => {
    const user = await makeUser("owner");
    await notificationsService.notify({
      recipientUserId: user.id,
      type: "ORDER_CONFIRMED",
      title: "Mine",
      body: "b",
      targetUrl: notificationLinks.customerOrder("order-1"),
      eventKey: eventKey(),
    });
    const notification = await prisma.notification.findFirst({ where: { recipientUserId: user.id, title: "Mine" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await callPost(notification!.id);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.read).toBe(true);

    const after = await prisma.notification.findUnique({ where: { id: notification!.id } });
    expect(after?.readAt).not.toBeNull();
  });

  it("is idempotent — marking an already-read notification read again still returns 200", async () => {
    const user = await makeUser("idempotent");
    await notificationsService.notify({
      recipientUserId: user.id,
      type: "ORDER_CONFIRMED",
      title: "Already read",
      body: "b",
      targetUrl: notificationLinks.customerOrder("order-2"),
      eventKey: eventKey(),
    });
    const notification = await prisma.notification.findFirst({ where: { recipientUserId: user.id, title: "Already read" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const first = await callPost(notification!.id);
    expect(first.status).toBe(200);
    const second = await callPost(notification!.id);
    expect(second.status).toBe(200);
  });

  it("IDOR: returns 404 (never 200/403) for another user's notification, and does not change its state", async () => {
    const owner = await makeUser("victim");
    const attacker = await makeUser("attacker");
    await notificationsService.notify({
      recipientUserId: owner.id,
      type: "ORDER_CONFIRMED",
      title: "Victim's notification",
      body: "b",
      targetUrl: notificationLinks.customerOrder("order-3"),
      eventKey: eventKey(),
    });
    const notification = await prisma.notification.findFirst({ where: { recipientUserId: owner.id, title: "Victim's notification" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(attacker));
    const response = await callPost(notification!.id);
    expect(response.status).toBe(404);

    const unchanged = await prisma.notification.findUnique({ where: { id: notification!.id } });
    expect(unchanged?.readAt).toBeNull();
  });

  it("returns 404 for a notification id that does not exist", async () => {
    const user = await makeUser("missing");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await callPost("does-not-exist");
    expect(response.status).toBe(404);
  });
});
