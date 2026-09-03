// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";

/**
 * M31 — POST/DELETE /api/v1/me/devices. Thin routes over the EXISTING
 * notificationsService.registerDevice/unregisterDevice. Verifies: auth,
 * that `userId` always comes from the session (never a client-supplied
 * field — there is no such field in the request shape at all), input
 * validation, and that a user can only ever unregister their own device.
 */
vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { POST, DELETE } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/v1/me/devices", { method: "POST", body: JSON.stringify(body) });
}

function deleteRequest(expoPushToken?: string) {
  const url = new URL("http://localhost/api/v1/me/devices");
  if (expoPushToken !== undefined) url.searchParams.set("expoPushToken", expoPushToken);
  return new Request(url, { method: "DELETE" });
}

describe("/api/v1/me/devices", () => {
  const createdUserIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }); // cascades to PushDevice
    await prisma.$disconnect();
  });

  async function makeUser(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `devices-api-${label}-${suffix}`, name: `Devices API ${label}`, email: `devices.api.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    return user;
  }

  describe("POST", () => {
    it("returns 401 when signed out", async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(null);
      const response = await POST(postRequest({ expoPushToken: "ExponentPushToken[x]", platform: "IOS" }));
      expect(response.status).toBe(401);
    });

    it("rejects a missing token", async () => {
      const user = await makeUser("missing-token");
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
      const response = await POST(postRequest({ platform: "IOS" }));
      expect(response.status).toBe(422);
    });

    it("rejects an invalid platform", async () => {
      const user = await makeUser("bad-platform");
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
      const response = await POST(postRequest({ expoPushToken: "ExponentPushToken[x]", platform: "WINDOWS_PHONE" }));
      expect(response.status).toBe(422);
    });

    it("registers a device for the signed-in user, regardless of what a client might pass as an unrelated field", async () => {
      const user = await makeUser("register");
      const token = `ExponentPushToken[api-${Date.now()}]`;
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));

      // Even if a malicious/buggy client included a `userId` field
      // targeting someone else, the route never reads it — see route.ts's
      // doc comment. Confirmed below by checking the row actually landed
      // under the SESSION's user, not any client-supplied id.
      const response = await POST(postRequest({ expoPushToken: token, platform: "IOS", userId: "someone-elses-id" }));
      expect(response.status).toBe(200);

      const device = await prisma.pushDevice.findUnique({ where: { expoPushToken: token } });
      expect(device?.userId).toBe(user.id);
      expect(device?.platform).toBe("IOS");
    });
  });

  describe("DELETE", () => {
    it("returns 401 when signed out", async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(null);
      const response = await DELETE(deleteRequest("x"));
      expect(response.status).toBe(401);
    });

    it("rejects a missing token", async () => {
      const user = await makeUser("delete-missing");
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
      const response = await DELETE(deleteRequest());
      expect(response.status).toBe(422);
    });

    it("does not remove another user's device", async () => {
      const owner = await makeUser("delete-owner");
      const attacker = await makeUser("delete-attacker");
      const token = `ExponentPushToken[api-del-${Date.now()}]`;

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(owner.id));
      await POST(postRequest({ expoPushToken: token, platform: "ANDROID" }));

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(attacker.id));
      const response = await DELETE(deleteRequest(token));
      expect(response.status).toBe(200); // no enumeration signal — reports success either way

      const stillThere = await prisma.pushDevice.findUnique({ where: { expoPushToken: token } });
      expect(stillThere?.userId).toBe(owner.id); // untouched
    });

    it("removes the caller's own device", async () => {
      const user = await makeUser("delete-own");
      const token = `ExponentPushToken[api-own-${Date.now()}]`;
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
      await POST(postRequest({ expoPushToken: token, platform: "ANDROID" }));

      const response = await DELETE(deleteRequest(token));
      expect(response.status).toBe(200);

      const gone = await prisma.pushDevice.findUnique({ where: { expoPushToken: token } });
      expect(gone).toBeNull();
    });
  });
});
