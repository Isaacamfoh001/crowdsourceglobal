// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";
import { quotationService } from "../../../../../modules/quotation/service";
import { ordersService } from "../../../../../modules/orders/service";

vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

const deliveryInfo = {
  recipientName: "Ama Customer",
  phone: "0244111222",
  addressLine1: "5 Customer Close",
  city: "Accra",
  region: "Greater Accra",
};

function sessionFor(user: { id: string; email: string; name: string }): Session {
  return {
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId: user.id, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

describe("GET /api/v1/orders/[id]", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdQuotationIds: string[] = [];
  const createdOrderIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.quotationItem.deleteMany({ where: { quotationId: { in: createdQuotationIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: createdQuotationIds } } });
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
    const vendor = await prisma.vendor.create({ data: { companyName: `Order Route Vendor ${label}`, storefrontSlug: `order-route-vendor-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Order Route Category ${label}`, slug: `order-route-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Order Route Listing", description: "Fixture.", basePrice: 25, moq: 1, availableQuantity: 50, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `order-route-customer-${label}-${suffix}`, name: `Order Route ${label}`, email: `order.route.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Order Route ${label}` } });

    const generated = await quotationService.generateFromDraft(profile.id, user.id, user.email, [{ listingId: listing.id, quantity: 1 }]);
    if (!generated.ok) throw new Error(generated.error);
    createdQuotationIds.push(generated.value.quotationId);

    const accepted = await ordersService.createOrderFromQuotation(profile.id, generated.value.quotationId, deliveryInfo);
    if (!accepted.ok) throw new Error(accepted.error);
    createdOrderIds.push(accepted.value.orderId);

    return { user, orderId: accepted.value.orderId };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/orders/x"), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("returns the owner's own order, pending payment, DTO-safe", async () => {
    const { user, orderId } = await setup("owner");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    const response = await GET(new Request(`http://localhost/api/v1/orders/${orderId}`), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.orderNumber).toEqual(expect.any(String));
    expect(body.data.status).toBe("PENDING_PAYMENT");
    expect(body.data.paymentStatus).toBe("UNPAID");
    expect(Object.keys(body.data).sort()).toEqual(["createdAt", "currency", "id", "orderNumber", "paymentStatus", "status", "total"].sort());
  });

  it("returns 404 for another customer's order", async () => {
    const { orderId } = await setup("victim");
    const attacker = await setup("attacker");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(attacker.user));
    const response = await GET(new Request(`http://localhost/api/v1/orders/${orderId}`), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(404);
  });
});
