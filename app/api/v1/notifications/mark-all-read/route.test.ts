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

describe("POST /api/v1/notifications/mark-all-read (M28)", () => {
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
    const user = await prisma.user.create({ data: { id: `notif-mar-${label}-${suffix}`, name: `Notif MAR ${label}`, email: `notif.mar.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    return user;
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/v1/notifications/mark-all-read", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("marks only the caller's own unread notifications read, leaving other users' untouched", async () => {
    const user = await makeUser("mine");
    const other = await makeUser("other");

    for (let i = 0; i < 2; i++) {
      await notificationsService.notify({
        recipientUserId: user.id,
        type: "ORDER_CONFIRMED",
        title: `Mine ${i}`,
        body: "b",
        targetUrl: notificationLinks.customerOrder(`order-mine-${i}`),
        eventKey: eventKey(),
      });
    }
    await notificationsService.notify({
      recipientUserId: other.id,
      type: "ORDER_CONFIRMED",
      title: "Other's",
      body: "b",
      targetUrl: notificationLinks.customerOrder("order-other"),
      eventKey: eventKey(),
    });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await POST(new Request("http://localhost/api/v1/notifications/mark-all-read", { method: "POST" }));
    expect(response.status).toBe(200);

    const unreadMine = await prisma.notification.count({ where: { recipientUserId: user.id, readAt: null } });
    const unreadOther = await prisma.notification.count({ where: { recipientUserId: other.id, readAt: null } });
    expect(unreadMine).toBe(0);
    expect(unreadOther).toBe(1);
  });
});
