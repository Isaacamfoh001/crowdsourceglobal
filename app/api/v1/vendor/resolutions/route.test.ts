// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";

/**
 * M29.1 — GET /api/v1/vendor/resolutions. Thin route over the EXISTING
 * resolutionsService.listForVendorPaginated (already vendor-scoped, M9/
 * M11.1) — this test verifies auth/ownership/DTO-shape only, not the
 * business logic the service-layer tests already cover.
 */
vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function getRequest() {
  return new Request("http://localhost/api/v1/vendor/resolutions");
}

describe("GET /api/v1/vendor/resolutions", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdCustomerProfileIds: string[] = [];
  const createdOrderIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.resolutionCaseItem.deleteMany({ where: { orderItem: { orderId: { in: createdOrderIds } } } });
    await prisma.resolutionCase.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerProfileIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.$disconnect();
  });

  async function makeCaseForVendor(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const category = await prisma.category.create({ data: { name: `Vendor Res ${label}`, slug: `m29-vres-cat-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);

    const vendor = await prisma.vendor.create({
      data: { companyName: `Vendor Res ${label} ${suffix}`, storefrontSlug: `m29-vres-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);

    const owner = await prisma.user.create({ data: { id: `m29-vres-owner-${label}-${suffix}`, name: "Owner", email: `m29.vres.owner.${label}.${suffix}@example.com` } });
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });

    const listing = await prisma.vendorListing.create({
      data: { title: "Vendor Res Listing", description: "x", basePrice: 50, vendorId: vendor.id, categoryId: category.id, availableQuantity: 100, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const customerUser = await prisma.user.create({
      data: { id: `m29-vres-cust-${label}-${suffix}`, name: "Secret Customer Name", email: `secret.customer.${label}.${suffix}@example.com` },
    });
    createdUserIds.push(customerUser.id);
    const customerProfile = await prisma.customerProfile.create({ data: { userId: customerUser.id, displayName: "Secret Customer Name" } });
    createdCustomerProfileIds.push(customerProfile.id);

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-VRES-${suffix}`,
        customerProfileId: customerProfile.id,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: 50,
        total: 50,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "Secret Customer Name", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdOrderIds.push(order.id);

    const orderItem = await prisma.orderItem.create({
      data: { orderId: order.id, listingId: listing.id, vendorId: vendor.id, description: "Vendor Res Item", quantity: 1, unitPrice: 50, vendorPayableBasis: 35, lineTotal: 50 },
    });
    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId: vendor.id, origin: "DOMESTIC_COLLECTION", status: "DELIVERED" } });
    await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 1, unitPrice: 50, vendorPayableBasis: 35 } });
    await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id } });

    const submitted = await resolutionsService.submitCase(customerProfile.id, customerUser.id, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "This item arrived broken, very disappointing.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed: " + submitted.error);

    return { vendorId: vendor.id, ownerUserId: owner.id, caseId: submitted.value.caseId, customerName: "Secret Customer Name", customerEmail: customerUser.email };
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated user with no vendor membership", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `m29-vres-nomember-${suffix}`, name: "No Vendor", email: `m29.vres.nomember.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
    const res = await GET(getRequest());
    expect(res.status).toBe(403);
  });

  it("lists only this vendor's own cases, with no customer identity/contact anywhere in the raw JSON", async () => {
    const a = await makeCaseForVendor("list-a");
    await makeCaseForVendor("list-b");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(a.ownerUserId));
    const res = await GET(getRequest());
    const raw = await res.text();
    const body = JSON.parse(raw);

    expect(res.status).toBe(200);
    const ids = body.data.rows.map((row: { id: string }) => row.id);
    expect(ids).toContain(a.caseId);
    expect(raw).not.toContain(a.customerName);
    expect(raw).not.toContain(a.customerEmail);
  });
});
