// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";

/**
 * Same convention as app/api/quotations/[id]/pdf/route.test.ts: only
 * getCurrentSession is stubbed — every other identity lookup this route
 * calls (getCurrentCustomerProfile, vendorsService, vendorApplicationsService)
 * stays real, against the real local Postgres dev database, so this exercises
 * the actual authorization/DTO-composition code path, not a re-implementation
 * of it. The bearer-token/native-auth mechanism itself is proved separately,
 * without this mock, in native-auth.test.ts.
 */
vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(user: { id: string; email: string; name: string; emailVerified: boolean }): Session {
  return {
    user: { ...user, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId: user.id, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function request() {
  return new Request("http://localhost/api/v1/me");
}

describe("GET /api/v1/me", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdApplicationApplicantIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.vendorApplication.deleteMany({ where: { applicantUserId: { in: createdApplicationApplicantIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function createUserWithCustomerProfile(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: { id: `m18-1-${label}-${suffix}`, name: `${label} User`, email: `${label}.${suffix}@example.com`, emailVerified: true },
    });
    createdUserIds.push(user.id);
    await prisma.customerProfile.create({ data: { userId: user.id, displayName: user.name } });
    return user;
  }

  it("returns 401 JSON (not a redirect) when there is no session", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "UNAUTHORIZED", message: expect.any(String) } });
  });

  it("returns the customer's own profile with no vendor capability for an ordinary customer", async () => {
    const user = await createUserWithCustomerProfile("plain");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor({ id: user.id, email: user.email, name: user.name, emailVerified: true }));

    const response = await GET(request());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.user).toEqual({ id: user.id, name: user.name, email: user.email, emailVerified: true });
    expect(body.data.customer).toEqual({ id: expect.any(String) });
    expect(body.data.vendor).toEqual({ available: false, memberships: [] });
    expect(body.data.vendorApplication).toBeNull();
  });

  it("reports vendor application status for a customer with a pending application and no membership yet", async () => {
    const user = await createUserWithCustomerProfile("pending-vendor");
    createdApplicationApplicantIds.push(user.id);
    const application = await prisma.vendorApplication.create({
      data: { applicantUserId: user.id, status: "UNDER_REVIEW", submittedAt: new Date() },
    });
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor({ id: user.id, email: user.email, name: user.name, emailVerified: true }));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.vendor).toEqual({ available: false, memberships: [] });
    expect(body.data.vendorApplication).toEqual({ id: application.id, status: "UNDER_REVIEW" });
  });

  it("shows both customer and vendor capability for an approved vendor owner (capability model, not a permanent role)", async () => {
    const user = await createUserWithCustomerProfile("approved-vendor");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: "M18.1 Vendor Co", storefrontSlug: `m18-1-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    await prisma.vendorMembership.create({ data: { userId: user.id, vendorId: vendor.id, role: "OWNER" } });
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor({ id: user.id, email: user.email, name: user.name, emailVerified: true }));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    // Customer capability is untouched by becoming a vendor — no fork.
    expect(body.data.customer).toEqual({ id: expect.any(String) });
    expect(body.data.vendor).toEqual({
      available: true,
      memberships: [{ vendorId: vendor.id, role: "OWNER", companyName: "M18.1 Vendor Co", verificationStatus: "APPROVED" }],
    });
  });

  it("never leaks another user's vendor membership or application into this user's response", async () => {
    const userA = await createUserWithCustomerProfile("isolation-a");
    const userB = await createUserWithCustomerProfile("isolation-b");
    createdApplicationApplicantIds.push(userB.id);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendorB = await prisma.vendor.create({
      data: { companyName: "Other Vendor", storefrontSlug: `m18-1-other-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendorB.id);
    await prisma.vendorMembership.create({ data: { userId: userB.id, vendorId: vendorB.id, role: "OWNER" } });
    await prisma.vendorApplication.create({ data: { applicantUserId: userB.id, status: "APPROVED" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor({ id: userA.id, email: userA.email, name: userA.name, emailVerified: true }));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.id).toBe(userA.id);
    expect(body.data.vendor).toEqual({ available: false, memberships: [] });
    expect(body.data.vendorApplication).toBeNull();
  });

  it("returns only the deliberate DTO fields — no raw Prisma rows, no internal/extra fields", async () => {
    const user = await createUserWithCustomerProfile("dto-shape");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: {
        companyName: "DTO Shape Vendor",
        storefrontSlug: `m18-1-dto-vendor-${suffix}`,
        verificationStatus: "APPROVED",
        country: "Ghana",
        // Fields that must NEVER leak onto this DTO even though they exist
        // on Vendor and are readable by the same repository query.
        pickupContactPhone: "0000000000",
      },
    });
    createdVendorIds.push(vendor.id);
    await prisma.vendorMembership.create({ data: { userId: user.id, vendorId: vendor.id, role: "OWNER" } });
    createdApplicationApplicantIds.push(user.id);
    const application = await prisma.vendorApplication.create({
      data: { applicantUserId: user.id, status: "APPROVED", vendorId: vendor.id, contactPhone: "0000000000", taxIdentifier: "SECRET-TIN" },
    });
    void application;

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor({ id: user.id, email: user.email, name: user.name, emailVerified: true }));

    const response = await GET(request());
    const body = await response.json();

    expect(Object.keys(body.data).sort()).toEqual(["customer", "user", "vendor", "vendorApplication"]);
    expect(Object.keys(body.data.user).sort()).toEqual(["email", "emailVerified", "id", "name"]);
    expect(Object.keys(body.data.customer).sort()).toEqual(["id"]);
    expect(Object.keys(body.data.vendor).sort()).toEqual(["available", "memberships"]);
    expect(Object.keys(body.data.vendor.memberships[0]).sort()).toEqual(["companyName", "role", "vendorId", "verificationStatus"]);
    expect(Object.keys(body.data.vendorApplication).sort()).toEqual(["id", "status"]);
    expect(JSON.stringify(body)).not.toContain("0000000000");
    expect(JSON.stringify(body)).not.toContain("SECRET-TIN");
  });
});
