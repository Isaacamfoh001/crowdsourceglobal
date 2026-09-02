// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";

vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: "Test", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

describe("GET /api/v1/cart", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdCartIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.cartItem.deleteMany({ where: { cartId: { in: createdCartIds } } });
    await prisma.cart.deleteMany({ where: { id: { in: createdCartIds } } });
    await prisma.vendorCostRule.deleteMany({ where: { listingId: { in: createdListingIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns the signed-in customer's cart, grouped by vendor with Money-shaped fields", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: "Cart Route Vendor", storefrontSlug: `cart-route-vendor-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: "Cart Route Category", slug: `cart-route-category-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Cart Route Listing", description: "Fixture.", basePrice: 20, moq: 1, availableQuantity: 10, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `cart-route-user-${suffix}`, name: "Cart Route User", email: `cart.route.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "Cart Route User" } });
    const cart = await prisma.cart.create({ data: { customerProfileId: profile.id } });
    createdCartIds.push(cart.id);
    await prisma.cartItem.create({ data: { cartId: cart.id, listingId: listing.id, quantity: 3 } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.itemCount).toBe(3);
    expect(body.data.vendorGroups).toHaveLength(1);
    expect(body.data.vendorGroups[0].vendor.id).toBe(vendor.id);
    expect(body.data.vendorGroups[0].lines[0].unitPrice).toEqual({ amount: "20.00", currency: "GHS" });
    expect(body.data.subtotal).toEqual({ amount: "60.00", currency: "GHS" });
  });
});
