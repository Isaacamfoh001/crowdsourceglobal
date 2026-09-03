// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";

/**
 * M29.1 — GET /api/v1/orders/:id/resolution-context. Thin route over the
 * EXISTING resolutionsService.getOrderContextForCustomer (the same context
 * the web ReportProblemForm already uses) — verifies auth/ownership only.
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

function getRequest(id: string) {
  return new Request(`http://localhost/api/v1/orders/${id}/resolution-context`);
}

describe("GET /api/v1/orders/:id/resolution-context", () => {
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
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerProfileIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.$disconnect();
  });

  async function makeOrder(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const category = await prisma.category.create({ data: { name: `Res Ctx ${label}`, slug: `m29-resctx-cat-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const vendor = await prisma.vendor.create({ data: { companyName: `Res Ctx Vendor ${label}`, storefrontSlug: `m29-resctx-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdVendorIds.push(vendor.id);
    const listing = await prisma.vendorListing.create({
      data: { title: "Res Ctx Listing", description: "x", basePrice: 40, vendorId: vendor.id, categoryId: category.id, availableQuantity: 100, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const customerUser = await prisma.user.create({ data: { id: `m29-resctx-cust-${label}-${suffix}`, name: "Ctx Customer", email: `m29.resctx.${label}.${suffix}@example.com` } });
    createdUserIds.push(customerUser.id);
    const customerProfile = await prisma.customerProfile.create({ data: { userId: customerUser.id, displayName: "Ctx Customer" } });
    createdCustomerProfileIds.push(customerProfile.id);

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-RESCTX-${suffix}`,
        customerProfileId: customerProfile.id,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: 40,
        total: 40,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "Ctx Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdOrderIds.push(order.id);
    const orderItem = await prisma.orderItem.create({
      data: { orderId: order.id, listingId: listing.id, vendorId: vendor.id, description: "Res Ctx Item", quantity: 2, unitPrice: 20, vendorPayableBasis: 14, lineTotal: 40 },
    });
    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId: vendor.id, origin: "DOMESTIC_COLLECTION", status: "PENDING" } });
    await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 2, unitPrice: 20, vendorPayableBasis: 14 } });
    await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id } });

    return { orderId: order.id, customerUserId: customerUser.id };
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const res = await GET(getRequest("does-not-matter"), { params: Promise.resolve({ id: "does-not-matter" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 for another customer's order — no enumeration signal", async () => {
    const owned = await makeOrder("ctx-owner");
    const other = await makeOrder("ctx-other");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(other.customerUserId));
    const res = await GET(getRequest(owned.orderId), { params: Promise.resolve({ id: owned.orderId }) });
    expect(res.status).toBe(404);
  });

  it("returns the owning customer's own resolution context", async () => {
    const { orderId, customerUserId } = await makeOrder("ctx-happy");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(customerUserId));

    const res = await GET(getRequest(orderId), { params: Promise.resolve({ id: orderId }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.orderId).toBe(orderId);
    expect(body.data.fulfilments[0].items[0].description).toBe("Res Ctx Item");
  });
});
