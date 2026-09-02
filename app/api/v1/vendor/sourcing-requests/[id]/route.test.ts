// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";
import { sourcingService } from "../../../../../../modules/sourcing/service";

/**
 * M25.2 — route-layer IDOR coverage for the new factory-facing
 * `/api/v1/vendor/sourcing-requests/*` surface. Same convention as
 * app/api/v1/vendor/orders/[id]/route.test.ts: only getCurrentSession is
 * stubbed — resolveVendorContext and sourcingService run for real against
 * the local dev database, so this exercises the actual authorization
 * wiring, not a reimplementation of it.
 */
vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { GET } from "./route";
import { POST } from "./respond/route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function getRequest(id: string) {
  return new Request(`http://localhost/api/v1/vendor/sourcing-requests/${id}`);
}

function postRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/v1/vendor/sourcing-requests/${id}/respond`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/v1/vendor/sourcing-requests/:id", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdRequestIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.sourcingOption.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.sourcingSolicitation.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.sourcingRequestActivity.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.customSourcingRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeVendorWithOwner(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `${label} Co`, storefrontSlug: `m252-api-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const owner = await prisma.user.create({
      data: { id: `m252-api-${label}-owner-${suffix}`, name: `${label} Owner`, email: `m252.api.${label}.${suffix}@example.com` },
    });
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });
    return { vendorId: vendor.id, ownerUserId: owner.id };
  }

  async function makeSolicitationFor(vendorId: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const customerUser = await prisma.user.create({
      data: { id: `m252-api-cust-${suffix}`, name: "Customer", email: `m252.api.cust.${suffix}@example.com` },
    });
    createdUserIds.push(customerUser.id);
    const customer = await prisma.customerProfile.create({ data: { userId: customerUser.id, displayName: "API Test Customer" } });
    createdCustomerIds.push(customer.id);

    const staffUser = await prisma.user.create({
      data: { id: `m252-api-staff-${suffix}`, name: "Staff", email: `m252.api.staff.${suffix}@example.com` },
    });
    createdUserIds.push(staffUser.id);

    const created = await sourcingService.submitRequest(customer.id, customerUser.id, customerUser.email, {
      title: "API test sourcing request",
      description: "1000 branded tote bags",
      quantity: 1000,
      deliveryCountry: "Ghana",
    }, []);
    if (!created.ok) throw new Error("submit failed");
    createdRequestIds.push(created.value.id);
    const id = created.value.id;
    await sourcingService.moveToUnderReview(id);
    await sourcingService.moveToSourcing(id);
    await sourcingService.sendToFactories(id, [vendorId], staffUser.id);

    const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
    return { requestId: id, solicitationId: rows[0]!.id, customerEmail: customerUser.email };
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const res = await GET(getRequest("nonexistent"), { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated user with no vendor membership", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `m252-api-nonvendor-${suffix}`, name: "No Vendor", email: `m252.api.nonvendor.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));

    const res = await GET(getRequest("nonexistent"), { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(403);
  });

  it("returns the factory's own solicitation with no customer name/email leaked", async () => {
    const { vendorId, ownerUserId } = await makeVendorWithOwner("owner");
    const { solicitationId, customerEmail } = await makeSolicitationFor(vendorId);
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUserId));

    const res = await GET(getRequest(solicitationId), { params: Promise.resolve({ id: solicitationId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(customerEmail);
    expect(serialized).not.toContain("customerName");
    expect(serialized).not.toContain("customerEmail");
  });

  it("returns 404 (not 403) for another factory's solicitation — no enumeration signal", async () => {
    const { vendorId: vendorAId } = await makeVendorWithOwner("a");
    const { ownerUserId: vendorBOwnerId } = await makeVendorWithOwner("b");
    const { solicitationId } = await makeSolicitationFor(vendorAId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(vendorBOwnerId));
    const res = await GET(getRequest(solicitationId), { params: Promise.resolve({ id: solicitationId }) });
    expect(res.status).toBe(404);
  });

  it("rejects a factory's attempt to respond to another factory's solicitation (IDOR write)", async () => {
    const { vendorId: vendorAId } = await makeVendorWithOwner("write-a");
    const { ownerUserId: vendorBOwnerId } = await makeVendorWithOwner("write-b");
    const { solicitationId } = await makeSolicitationFor(vendorAId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(vendorBOwnerId));
    const res = await POST(postRequest(solicitationId, { canFulfil: true, proposedQuantity: 100, unitPrice: 10 }), {
      params: Promise.resolve({ id: solicitationId }),
    });
    expect(res.status).toBe(422);

    // Confirm the forged response never actually landed against vendor A's real solicitation.
    const { rows } = await sourcingService.listSolicitationsForVendor(vendorAId);
    expect(rows.find((r) => r.id === solicitationId)?.status).toBe("SENT");
  });

  it("lets the correct factory submit a real CAN FULFIL response", async () => {
    const { vendorId, ownerUserId } = await makeVendorWithOwner("respond");
    const { solicitationId } = await makeSolicitationFor(vendorId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUserId));
    const res = await POST(postRequest(solicitationId, { canFulfil: true, proposedQuantity: 1000, unitPrice: 12, leadTimeDays: 7 }), {
      params: Promise.resolve({ id: solicitationId }),
    });
    expect(res.status).toBe(200);

    const detail = await GET(getRequest(solicitationId), { params: Promise.resolve({ id: solicitationId }) });
    const body = await detail.json();
    expect(body.data.status).toBe("RESPONDED");
    expect(body.data.response.proposedQuantity).toBe(1000);
  });
});
