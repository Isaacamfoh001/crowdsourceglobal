// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";

/**
 * M27 — route-layer test for the new `/api/v1/vendor/*` guard
 * (`resolveVendorContext`) and the multi-vendor privacy requirement
 * (M27 §26: "Vendor A cannot access Vendor B fulfilment"). Same
 * convention as app/api/v1/me/route.test.ts: only getCurrentSession is
 * stubbed — everything else (resolveVendorContext, fulfilmentService)
 * runs for real against the local dev database, so this exercises the
 * actual authorization wiring this milestone added, not a
 * reimplementation of it.
 */
vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function request(id: string) {
  return new Request(`http://localhost/api/v1/vendor/orders/${id}`);
}

describe("GET /api/v1/vendor/orders/:id", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdOrderIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeVendorWithOwner(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `${label} Co`, storefrontSlug: `m27-order-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const owner = await prisma.user.create({ data: { id: `m27-${label}-owner-${suffix}`, name: `${label} Owner`, email: `m27.${label}.${suffix}@example.com` } });
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });
    return { vendorId: vendor.id, ownerUserId: owner.id };
  }

  async function makeFulfilmentForVendor(vendorId: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const customerUser = await prisma.user.create({ data: { id: `m27-cust-${suffix}`, name: "Customer", email: `m27.cust.${suffix}@example.com` } });
    createdUserIds.push(customerUser.id);
    const customer = await prisma.customerProfile.create({ data: { userId: customerUser.id, displayName: "Customer" } });
    createdCustomerIds.push(customer.id);
    const order = await prisma.order.create({
      data: {
        orderNumber: `M27-${suffix}`,
        subtotal: 100,
        total: 100,
        deliveryInfo: { recipientName: "Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
        customerProfileId: customer.id,
      },
    });
    createdOrderIds.push(order.id);
    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId, origin: "DOMESTIC_COLLECTION" } });
    return fulfilment.id;
  }

  it("returns 401 JSON (not a redirect) when there is no session", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);

    const response = await GET(request("anything"), { params: Promise.resolve({ id: "anything" }) });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 for a signed-in user with no approved vendor membership", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const customerOnlyUser = await prisma.user.create({ data: { id: `m27-plain-${suffix}`, name: "Plain", email: `m27.plain.${suffix}@example.com` } });
    createdUserIds.push(customerOnlyUser.id);
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(customerOnlyUser.id));

    const response = await GET(request("anything"), { params: Promise.resolve({ id: "anything" }) });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 (never another vendor's data) when Vendor A requests Vendor B's fulfilment", async () => {
    const vendorA = await makeVendorWithOwner("a");
    const vendorB = await makeVendorWithOwner("b");
    const vendorBFulfilmentId = await makeFulfilmentForVendor(vendorB.vendorId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(vendorA.ownerUserId));

    const response = await GET(request(vendorBFulfilmentId), { params: Promise.resolve({ id: vendorBFulfilmentId }) });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 200 with the fulfilment when the vendor requests their own", async () => {
    const vendorA = await makeVendorWithOwner("own");
    const fulfilmentId = await makeFulfilmentForVendor(vendorA.vendorId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(vendorA.ownerUserId));

    const response = await GET(request(fulfilmentId), { params: Promise.resolve({ id: fulfilmentId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(fulfilmentId);
    expect(body.data.status).toBe("PENDING");
  });
});
