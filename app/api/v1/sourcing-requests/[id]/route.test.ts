// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";
import { sourcingService } from "../../../../../modules/sourcing/service";

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

function getRequest() {
  return new Request("http://localhost/api/v1/sourcing-requests/x");
}

describe("GET /api/v1/sourcing-requests/[id]", () => {
  const createdUserIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.sourcingRequestAttachment.deleteMany({ where: { sourcingRequest: { customerProfile: { userId: { in: createdUserIds } } } } });
    await prisma.sourcingRequestActivity.deleteMany({ where: { sourcingRequest: { customerProfile: { userId: { in: createdUserIds } } } } });
    await prisma.customSourcingRequest.deleteMany({ where: { customerProfile: { userId: { in: createdUserIds } } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function createCustomer(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `sourcing-detail-route-${label}-${suffix}`, name: `Route ${label}`, email: `sourcing.detail.route.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Route ${label}` } });
    return { user, profileId: profile.id };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(getRequest(), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("returns 404 for another customer's request (no enumeration signal)", async () => {
    const owner = await createCustomer("owner");
    const other = await createCustomer("other");

    const submitted = await sourcingService.submitRequest(owner.profileId, owner.user.id, owner.user.email, {
      description: "Owner-only request",
      quantity: 1,
      deliveryCountry: "Ghana",
    }, []);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(other.user));
    const response = await GET(getRequest(), { params: Promise.resolve({ id: submitted.value.id }) });
    expect(response.status).toBe(404);
  });

  it("returns the owner's own request with an absolute attachment URL", async () => {
    const owner = await createCustomer("self");
    const submitted = await sourcingService.submitRequest(owner.profileId, owner.user.id, owner.user.email, {
      description: "Self-view request",
      quantity: 2,
      deliveryCountry: "Ghana",
    }, [{ buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), filename: "item.png", mimeType: "image/png" }]);
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(owner.user));
    const response = await GET(getRequest(), { params: Promise.resolve({ id: submitted.value.id }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.description).toBe("Self-view request");
    expect(body.data.attachments).toHaveLength(1);
    expect(body.data.attachments[0].isImage).toBe(true);
    expect(body.data.attachments[0].url).toMatch(/^https?:\/\/.*\/api\/sourcing\/attachments\//);
  });
});
