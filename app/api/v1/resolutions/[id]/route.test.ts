// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";
import { resolutionsService } from "../../../../../modules/resolutions/service";

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

describe("GET /api/v1/resolutions/[id] (M26 — read-only case detail)", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdOrderIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.resolutionCaseActivity.deleteMany({ where: { resolutionCase: { orderId: { in: createdOrderIds } } } });
    await prisma.resolutionCaseItem.deleteMany({ where: { resolutionCase: { orderId: { in: createdOrderIds } } } });
    await prisma.resolutionCase.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.vendorCostRule.deleteMany({ where: { listingId: { in: createdListingIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function setup(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `Resolution Route Vendor ${label}`, storefrontSlug: `resolution-route-vendor-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Resolution Route Category ${label}`, slug: `resolution-route-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Resolution Route Listing", description: "Fixture.", basePrice: 25, moq: 1, availableQuantity: 50, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `resolution-route-customer-${label}-${suffix}`, name: `Resolution Route ${label}`, email: `resolution.route.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Resolution Route ${label}` } });

    const order = await prisma.order.create({
      data: {
        customerProfileId: profile.id,
        orderNumber: `RES-RT-${suffix}`,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: 25,
        total: 25,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "Resolution Route", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdOrderIds.push(order.id);

    const orderItem = await prisma.orderItem.create({
      data: { orderId: order.id, listingId: listing.id, vendorId: vendor.id, description: "Resolution Route Listing", quantity: 1, unitPrice: 25, vendorPayableBasis: 17.5, lineTotal: 25 },
    });
    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId: vendor.id, origin: "DOMESTIC_COLLECTION" } });
    await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 1, unitPrice: 25, vendorPayableBasis: 17.5 } });
    await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id } });

    const submitted = await resolutionsService.submitCase(profile.id, user.id, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "Item arrived damaged, corner crushed.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error(submitted.error);

    return { user, caseId: submitted.value.caseId };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/resolutions/x"), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("returns the owning customer's case with real refund/return status, never vendor-cost fields", async () => {
    const { user, caseId } = await setup("owner");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    const response = await GET(new Request(`http://localhost/api/v1/resolutions/${caseId}`), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.caseNumber).toEqual(expect.any(String));
    expect(body.data.issueType).toBe("ITEM_DAMAGED");
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].unitPrice).toEqual({ amount: "25.00", currency: "GHS" });
    expect(body.data.refunds).toEqual([]);
    const raw = JSON.stringify(body.data);
    expect(raw).not.toMatch(/vendorPayableBasis|vendorCost|payoutHold|responsibility/i);
  });

  it("returns 404 for another customer's case (IDOR)", async () => {
    const { caseId } = await setup("victim");
    const attacker = await setup("attacker");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(attacker.user));
    const response = await GET(new Request(`http://localhost/api/v1/resolutions/${caseId}`), { params: Promise.resolve({ id: caseId }) });
    expect(response.status).toBe(404);
  });
});
