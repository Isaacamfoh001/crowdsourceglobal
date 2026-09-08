// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";

vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { PATCH } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(user: { id: string; email: string; name: string }): Session {
  return {
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId: user.id, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/v1/me/experience", { method: "PATCH", body: JSON.stringify(body) });
}

/**
 * M32.3 — Experience Mode is a UI preference only, never authorization:
 * these tests confirm the value round-trips onto `CustomerProfile` and
 * that this route rejects garbage input, but deliberately do NOT assert
 * anything about vendor eligibility — that's still decided entirely by
 * `/api/v1/vendor/*` routes re-deriving their own context, unaffected by
 * this field.
 */
describe("PATCH /api/v1/me/experience", () => {
  const createdUserIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function createUserWithCustomerProfile(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: { id: `m32-3-exp-${label}-${suffix}`, name: `${label} User`, email: `${label}.${suffix}@example.com` },
    });
    createdUserIds.push(user.id);
    await prisma.customerProfile.create({ data: { userId: user.id, displayName: user.name } });
    return user;
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await PATCH(patchRequest({ preferredExperience: "SELLER" }));
    expect(response.status).toBe(401);
  });

  it("rejects a value outside the fixed experience set", async () => {
    const user = await createUserWithCustomerProfile("invalid");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    const response = await PATCH(patchRequest({ preferredExperience: "ADMIN" }));
    expect(response.status).toBe(422);

    const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
    expect(profile?.preferredExperience).toBeNull();
  });

  it("persists a valid experience and it round-trips via /api/v1/me", async () => {
    const user = await createUserWithCustomerProfile("valid");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    const response = await PATCH(patchRequest({ preferredExperience: "FACTORY" }));
    expect(response.status).toBe(200);

    const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
    expect(profile?.preferredExperience).toBe("FACTORY");
  });

  it("accepts null to clear the preference back to the first-run chooser state", async () => {
    const user = await createUserWithCustomerProfile("clear");
    await prisma.customerProfile.update({ where: { userId: user.id }, data: { preferredExperience: "BUYER" } });
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    const response = await PATCH(patchRequest({ preferredExperience: null }));
    expect(response.status).toBe(200);

    const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
    expect(profile?.preferredExperience).toBeNull();
  });

  it("never touches another user's preference", async () => {
    const userA = await createUserWithCustomerProfile("isolation-a");
    const userB = await createUserWithCustomerProfile("isolation-b");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userA));

    await PATCH(patchRequest({ preferredExperience: "BEAUTY" }));

    const profileB = await prisma.customerProfile.findUnique({ where: { userId: userB.id } });
    expect(profileB?.preferredExperience).toBeNull();
  });
});
