// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";
import { notificationsService } from "../../../../../modules/notifications/service";
import { notificationLinks } from "../../../../../modules/notifications/links";

vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { GET } from "./route";

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

describe("GET /api/v1/notifications/unread-count (M28)", () => {
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
    const user = await prisma.user.create({ data: { id: `notif-unread-${label}-${suffix}`, name: `Notif Unread ${label}`, email: `notif.unread.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    return user;
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/notifications/unread-count"));
    expect(response.status).toBe(401);
  });

  it("returns 0 for a user with no notifications", async () => {
    const user = await makeUser("zero");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await GET(new Request("http://localhost/api/v1/notifications/unread-count"));
    const body = await response.json();
    expect(body.data.unreadCount).toBe(0);
  });

  it("counts only this user's unread notifications, excluding read ones and other users'", async () => {
    const user = await makeUser("mine");
    const other = await makeUser("other");

    await notificationsService.notify({
      recipientUserId: user.id,
      type: "ORDER_CONFIRMED",
      title: "Unread 1",
      body: "b",
      targetUrl: notificationLinks.customerOrder("order-1"),
      eventKey: eventKey(),
    });
    await notificationsService.notify({
      recipientUserId: user.id,
      type: "ORDER_CONFIRMED",
      title: "Read already",
      body: "b",
      targetUrl: notificationLinks.customerOrder("order-2"),
      eventKey: eventKey(),
    });
    const readOne = await prisma.notification.findFirst({ where: { recipientUserId: user.id, title: "Read already" } });
    await notificationsService.markRead(readOne!.id, user.id);

    await notificationsService.notify({
      recipientUserId: other.id,
      type: "ORDER_CONFIRMED",
      title: "Someone else's unread",
      body: "b",
      targetUrl: notificationLinks.customerOrder("order-3"),
      eventKey: eventKey(),
    });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await GET(new Request("http://localhost/api/v1/notifications/unread-count"));
    const body = await response.json();
    expect(body.data.unreadCount).toBe(1);
  });
});
