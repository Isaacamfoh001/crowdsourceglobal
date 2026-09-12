// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";
import { sourcingService } from "../../../../../modules/sourcing/service";

/**
 * M32.10.3 — the mobile bug this fixes was never a backend authorization
 * bug (modules/sourcing/service.test.ts already covers owner/staff/
 * solicited-vendor/unsolicited-vendor access at the service layer). This
 * file covers the one thing that layer can't: that the ROUTE actually
 * streams the real image bytes with the real Content-Type for an allowed
 * caller, which is the behavior the mobile fetch depends on.
 */
vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function getRequest(id: string) {
  return new Request(`http://localhost/api/sourcing/attachments/${id}`);
}

describe("GET /api/sourcing/attachments/[id]", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdRequestIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.sourcingSolicitation.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.sourcingRequestActivity.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.sourcingRequestAttachment.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.customSourcingRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeRequestWithPhoto(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const customerUser = await prisma.user.create({
      data: { id: `m321031-cust-${label}-${suffix}`, name: "Customer", email: `m321031.cust.${label}.${suffix}@example.com` },
    });
    createdUserIds.push(customerUser.id);
    const customer = await prisma.customerProfile.create({ data: { userId: customerUser.id, displayName: "Attachment Customer" } });
    createdCustomerIds.push(customer.id);

    const created = await sourcingService.submitRequest(
      customer.id,
      customerUser.id,
      customerUser.email,
      { title: "Route download test", description: "See photo", quantity: 1, deliveryCountry: "Ghana" },
      [{ buffer: JPEG_MAGIC, filename: "reference.jpg", mimeType: "image/jpeg" }],
    );
    if (!created.ok) throw new Error("submit failed");
    createdRequestIds.push(created.value.id);

    const detail = await sourcingService.getDetailForCustomer(created.value.id, customer.id);
    if (!detail) throw new Error("detail lookup failed");
    return { requestId: created.value.id, attachmentId: detail.attachments[0]!.id, customerUserId: customerUser.id };
  }

  async function makeVendorWithOwner(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `${label} Co`, storefrontSlug: `m321031-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const owner = await prisma.user.create({
      data: { id: `m321031-vendor-${label}-${suffix}`, name: `${label} Owner`, email: `m321031.vendor.${label}.${suffix}@example.com` },
    });
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });
    return { vendorId: vendor.id, ownerUserId: owner.id };
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const res = await GET(getRequest("nonexistent"), { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(401);
  });

  it("returns the real image bytes and content type to the owning customer", async () => {
    const { attachmentId, customerUserId } = await makeRequestWithPhoto("owner");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(customerUserId));

    const res = await GET(getRequest(attachmentId), { params: Promise.resolve({ id: attachmentId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
    expect(Buffer.from(bytes).subarray(0, JPEG_MAGIC.length)).toEqual(JPEG_MAGIC);
  });

  it("returns the image bytes to a factory solicited on the request", async () => {
    const { requestId, attachmentId } = await makeRequestWithPhoto("solicited");
    const { vendorId, ownerUserId } = await makeVendorWithOwner("solicited");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const staffUser = await prisma.user.create({
      data: { id: `m321031-staff-${suffix}`, name: "Staff", email: `m321031.staff.${suffix}@example.com` },
    });
    createdUserIds.push(staffUser.id);

    await sourcingService.moveToUnderReview(requestId);
    await sourcingService.moveToSourcing(requestId);
    await sourcingService.sendToFactories(requestId, [vendorId], staffUser.id);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUserId));
    const res = await GET(getRequest(attachmentId), { params: Promise.resolve({ id: attachmentId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("denies an unrelated (unsolicited) factory — 404, no enumeration signal", async () => {
    const { attachmentId } = await makeRequestWithPhoto("unsolicited");
    const { ownerUserId } = await makeVendorWithOwner("unsolicited");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUserId));
    const res = await GET(getRequest(attachmentId), { params: Promise.resolve({ id: attachmentId }) });
    expect(res.status).toBe(404);
  });
});
