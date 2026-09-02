// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";
import { quotationService } from "../../../../modules/quotation/service";
import { ordersService } from "../../../../modules/orders/service";

vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
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

describe("GET /api/v1/orders (M26)", () => {
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
    await prisma.vendorEarning.deleteMany({ where: { orderId: { in: createdOrderIds } } });
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

  async function makeCustomer(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `orders-list-customer-${label}-${suffix}`, name: `Orders List ${label}`, email: `orders.list.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Orders List ${label}` } });
    return { user, profile };
  }

  async function makeOrder(label: string, profileId: string, userEmail: string, userId: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `Orders List Vendor ${label}`, storefrontSlug: `orders-list-vendor-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Orders List Category ${label}`, slug: `orders-list-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Orders List Listing", description: "Fixture.", basePrice: 10, moq: 1, availableQuantity: 50, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const generated = await quotationService.generateFromDraft(profileId, userId, userEmail, [{ listingId: listing.id, quantity: 1 }]);
    if (!generated.ok) throw new Error(generated.error);
    createdQuotationIds.push(generated.value.quotationId);

    const accepted = await ordersService.createOrderFromQuotation(profileId, generated.value.quotationId, deliveryInfo);
    if (!accepted.ok) throw new Error(accepted.error);
    createdOrderIds.push(accepted.value.orderId);
    return accepted.value.orderId;
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/orders"));
    expect(response.status).toBe(401);
  });

  it("returns only this customer's own orders, newest-first, paginated envelope", async () => {
    const { user, profile } = await makeCustomer("mine");
    const older = await makeOrder("older", profile.id, user.email, user.id);
    // Ensure a distinct createdAt ordering even on a fast test runner.
    await prisma.order.update({ where: { id: older }, data: { createdAt: new Date(Date.now() - 60_000) } });
    const newer = await makeOrder("newer", profile.id, user.email, user.id);

    const { profile: otherProfile, user: otherUser } = await makeCustomer("other");
    await makeOrder("other-order", otherProfile.id, otherUser.email, otherUser.id);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await GET(new Request("http://localhost/api/v1/orders"));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.rows.map((r: { id: string }) => r.id)).toEqual([newer, older]);
    expect(body.data.page).toBe(1);
    expect(body.data.total).toBe(2);
    const row = body.data.rows[0];
    expect(Object.keys(row).sort()).toEqual(
      ["id", "orderNumber", "createdAt", "status", "paymentStatus", "displayStatus", "displayStatusLabel", "total", "currency", "itemCount", "vendorCount", "thumbnailUrl"].sort(),
    );
    expect(row.vendorCount).toBe(0); // PENDING_PAYMENT — no Fulfilment/package exists yet
  });
});
