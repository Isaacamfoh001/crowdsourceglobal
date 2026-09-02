// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";

vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { PATCH, DELETE } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: "Test", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function patchRequest(itemId: string, body: unknown) {
  return new Request(`http://localhost/api/v1/cart/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(itemId: string) {
  return new Request(`http://localhost/api/v1/cart/items/${itemId}`, { method: "DELETE" });
}

describe("PATCH/DELETE /api/v1/cart/items/[id]", () => {
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
    const vendor = await prisma.vendor.create({ data: { companyName: `Cart Item Vendor ${label}`, storefrontSlug: `cart-item-vendor-${label}-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Cart Item Category ${label}`, slug: `cart-item-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Cart Item Listing", description: "Fixture.", basePrice: 10, moq: 1, availableQuantity: 15, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const ownerUser = await prisma.user.create({ data: { id: `cart-item-owner-${label}-${suffix}`, name: `Owner ${label}`, email: `cart.item.owner.${label}.${suffix}@example.com` } });
    createdUserIds.push(ownerUser.id);
    const ownerProfile = await prisma.customerProfile.create({ data: { userId: ownerUser.id, displayName: `Owner ${label}` } });
    const cart = await prisma.cart.create({ data: { customerProfileId: ownerProfile.id } });
    createdCartIds.push(cart.id);
    const item = await prisma.cartItem.create({ data: { cartId: cart.id, listingId: listing.id, quantity: 2 } });

    const otherUser = await prisma.user.create({ data: { id: `cart-item-other-${label}-${suffix}`, name: `Other ${label}`, email: `cart.item.other.${label}.${suffix}@example.com` } });
    createdUserIds.push(otherUser.id);
    await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: `Other ${label}` } });

    return { ownerUserId: ownerUser.id, otherUserId: otherUser.id, itemId: item.id };
  }

  it("PATCH: rejects updating another customer's cart item (IDOR) with NOT_FOUND, never revealing it exists", async () => {
    const { otherUserId, itemId } = await setup("patch-idor");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(otherUserId));
    const response = await PATCH(patchRequest(itemId, { quantity: 5 }), { params: Promise.resolve({ id: itemId }) });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.message).toMatch(/not found/i);
  });

  it("PATCH: the owner can update their own item's quantity", async () => {
    const { ownerUserId, itemId } = await setup("patch-owner");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUserId));
    const response = await PATCH(patchRequest(itemId, { quantity: 4 }), { params: Promise.resolve({ id: itemId }) });
    expect(response.status).toBe(200);
    const updated = await prisma.cartItem.findUnique({ where: { id: itemId } });
    expect(updated?.quantity).toBe(4);
  });

  it("PATCH: a quantity of 0 removes the item, same as web", async () => {
    const { ownerUserId, itemId } = await setup("patch-zero");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUserId));
    const response = await PATCH(patchRequest(itemId, { quantity: 0 }), { params: Promise.resolve({ id: itemId }) });
    expect(response.status).toBe(200);
    const deleted = await prisma.cartItem.findUnique({ where: { id: itemId } });
    expect(deleted).toBeNull();
  });

  it("DELETE: rejects removing another customer's cart item (IDOR)", async () => {
    const { otherUserId, itemId } = await setup("delete-idor");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(otherUserId));
    const response = await DELETE(deleteRequest(itemId), { params: Promise.resolve({ id: itemId }) });
    expect(response.status).toBe(404);
    const stillExists = await prisma.cartItem.findUnique({ where: { id: itemId } });
    expect(stillExists).not.toBeNull();
  });

  it("DELETE: the owner can remove their own item", async () => {
    const { ownerUserId, itemId } = await setup("delete-owner");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUserId));
    const response = await DELETE(deleteRequest(itemId), { params: Promise.resolve({ id: itemId }) });
    expect(response.status).toBe(200);
    const removed = await prisma.cartItem.findUnique({ where: { id: itemId } });
    expect(removed).toBeNull();
  });
});
