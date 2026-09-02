// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";
import { notificationsService } from "../../../../modules/notifications/service";
import { notificationLinks } from "../../../../modules/notifications/links";

vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
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

describe("GET /api/v1/notifications (M28)", () => {
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
    const user = await prisma.user.create({ data: { id: `notif-api-${label}-${suffix}`, name: `Notif API ${label}`, email: `notif.api.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    return user;
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/notifications"));
    expect(response.status).toBe(401);
  });

  it("returns only this user's own notifications, newest-first, paginated envelope, with a mobile-safe DTO shape", async () => {
    const user = await makeUser("mine");
    await notificationsService.notify({
      recipientUserId: user.id,
      type: "ORDER_CONFIRMED",
      title: "Order confirmed",
      body: "Your order has been confirmed.",
      targetUrl: notificationLinks.customerOrder("order-older"),
      eventKey: eventKey(),
    });
    await prisma.notification.updateMany({ where: { recipientUserId: user.id }, data: { createdAt: new Date(Date.now() - 60_000) } });
    await notificationsService.notify({
      recipientUserId: user.id,
      type: "DELIVERED",
      title: "Delivered",
      body: "Your order was delivered.",
      targetUrl: notificationLinks.customerOrder("order-newer"),
      eventKey: eventKey(),
    });

    const other = await makeUser("other");
    await notificationsService.notify({
      recipientUserId: other.id,
      type: "ORDER_CONFIRMED",
      title: "Someone else's order",
      body: "Not yours.",
      targetUrl: notificationLinks.customerOrder("order-other"),
      eventKey: eventKey(),
    });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await GET(new Request("http://localhost/api/v1/notifications"));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.rows.map((r: { title: string }) => r.title)).toEqual(["Delivered", "Order confirmed"]);
    expect(body.data.page).toBe(1);
    expect(body.data.total).toBe(2);

    const row = body.data.rows[0];
    expect(Object.keys(row).sort()).toEqual(["id", "type", "title", "body", "targetUrl", "readAt", "createdAt"].sort());
    expect(row.readAt).toBeNull();
    expect(row.targetUrl).toBe("/account/orders/order-newer");
  });

  it("paginates with the shared page-size convention", async () => {
    const user = await makeUser("paged");
    for (let i = 0; i < 3; i++) {
      await notificationsService.notify({
        recipientUserId: user.id,
        type: "PACKAGE_COLLECTED",
        title: `Collected ${i}`,
        body: "Package collected.",
        targetUrl: notificationLinks.customerOrder(`order-page-${i}`),
        eventKey: eventKey(),
      });
    }

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await GET(new Request("http://localhost/api/v1/notifications?page=1"));
    const body = await response.json();
    expect(body.data.total).toBe(3);
    expect(body.data.rows).toHaveLength(3);
    expect(body.data.totalPages).toBe(1);
  });
});
