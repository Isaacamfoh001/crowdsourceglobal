// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";

vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
import { POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

const validDelivery = {
  recipientName: "Ama Customer",
  phone: "0244111222",
  addressLine1: "5 Customer Close",
  city: "Accra",
  region: "Greater Accra",
};

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: "Test", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function request(body: unknown) {
  return new Request("http://localhost/api/v1/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/checkout", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdCartIds: string[] = [];
  const createdOrderIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
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

  async function setupCustomer(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `checkout-user-${label}-${suffix}`, name: `Checkout ${label}`, email: `checkout.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Checkout ${label}` } });
    return { userId: user.id, profileId: profile.id };
  }

  async function setupListing(label: string, overrides: { availableQuantity?: number } = {}) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `Checkout Vendor ${label}`, storefrontSlug: `checkout-vendor-${label}-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Checkout Category ${label}`, slug: `checkout-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId: vendor.id,
        categoryId: category.id,
        title: "Checkout Listing",
        description: "Fixture.",
        basePrice: 25,
        moq: 1,
        availableQuantity: overrides.availableQuantity ?? 10,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });
    createdListingIds.push(listing.id);
    await prisma.vendorCostRule.create({ data: { listingId: listing.id, vendorSupplyCost: 15, marginRuleType: "PERCENTAGE", marginValue: 30 } });
    return listing.id;
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(request(validDelivery));
    expect(response.status).toBe(401);
  });

  it("returns a validation error for an empty cart", async () => {
    const { userId } = await setupCustomer("empty");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request(validDelivery));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.message).toMatch(/cart is empty/i);
  });

  it("rejects an invalid delivery payload before touching the cart", async () => {
    const { userId } = await setupCustomer("invalid-delivery");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request({ ...validDelivery, region: "" }));
    expect(response.status).toBe(422);
  });

  it("creates a PENDING_PAYMENT order from the cart, reserving inventory, and converts the cart", async () => {
    const { userId, profileId } = await setupCustomer("happy");
    const listingId = await setupListing("happy");
    const cart = await prisma.cart.create({ data: { customerProfileId: profileId } });
    createdCartIds.push(cart.id);
    await prisma.cartItem.create({ data: { cartId: cart.id, listingId, quantity: 3 } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request(validDelivery));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.orderId).toBeTruthy();
    createdOrderIds.push(body.data.orderId);

    const order = await prisma.order.findUnique({ where: { id: body.data.orderId }, include: { items: true, reservations: true } });
    expect(order?.status).toBe("PENDING_PAYMENT");
    expect(order?.paymentStatus).toBe("UNPAID");
    expect(order?.total.toNumber()).toBe(75);
    expect(order?.reservations).toHaveLength(1);
    expect(order?.reservations[0]?.quantity).toBe(3);

    const listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(listing?.availableQuantity).toBe(7); // 10 - 3, atomically decremented

    const refreshedCart = await prisma.cart.findUnique({ where: { id: cart.id } });
    expect(refreshedCart?.status).toBe("CONVERTED");
  });

  it("rejects checkout when cart quantity exceeds live availability, never overselling", async () => {
    const { userId, profileId } = await setupCustomer("oversell");
    const listingId = await setupListing("oversell", { availableQuantity: 2 });
    const cart = await prisma.cart.create({ data: { customerProfileId: profileId } });
    createdCartIds.push(cart.id);
    await prisma.cartItem.create({ data: { cartId: cart.id, listingId, quantity: 5 } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request(validDelivery));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.message).toMatch(/limited quantity/i);

    const listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(listing?.availableQuantity).toBe(2); // untouched — never partially decremented
  });
});
