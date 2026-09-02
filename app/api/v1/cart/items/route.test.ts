// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";

vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: "Test", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function request(body: unknown) {
  return new Request("http://localhost/api/v1/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/cart/items", () => {
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

  async function setup(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `Cart Items Vendor ${label}`, storefrontSlug: `cart-items-vendor-${label}-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Cart Items Category ${label}`, slug: `cart-items-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Cart Items Listing", description: "Fixture.", basePrice: 10, moq: 3, maxOq: 20, availableQuantity: 15, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);
    const user = await prisma.user.create({ data: { id: `cart-items-user-${label}-${suffix}`, name: `Cart Items ${label}`, email: `cart.items.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Cart Items ${label}` } });
    return { userId: user.id, listingId: listing.id };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(request({ listingId: "x", quantity: 1 }));
    expect(response.status).toBe(401);
  });

  it("rejects a quantity below MOQ, surfacing the service's own validation message", async () => {
    const { userId, listingId } = await setup("moq");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request({ listingId, quantity: 1 }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.message).toMatch(/minimum order quantity/i);
  });

  it("adds a valid quantity and returns the refreshed cart view", async () => {
    const { userId, listingId } = await setup("happy");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request({ listingId, quantity: 5 }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.itemCount).toBe(5);

    const cart = await prisma.cart.findFirst({ where: { customerProfileId: (await prisma.customerProfile.findFirst({ where: { userId } }))!.id } });
    if (cart) createdCartIds.push(cart.id);
  });

  it("rejects a non-numeric quantity", async () => {
    const { userId, listingId } = await setup("validation");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request({ listingId, quantity: "five" }));
    expect(response.status).toBe(422);
  });
});
