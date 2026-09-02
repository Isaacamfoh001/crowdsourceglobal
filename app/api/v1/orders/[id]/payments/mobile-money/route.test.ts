// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../../lib/db";

const initiate = vi.fn();
const verify = vi.fn();
const parseWebhook = vi.fn();
const mockedPaystackProvider = {
  name: "PAYSTACK" as const,
  initiate: (...args: unknown[]) => initiate(...args),
  verify: (...args: unknown[]) => verify(...args),
  parseWebhook: (...args: unknown[]) => parseWebhook(...args),
};
vi.mock("../../../../../../../modules/payments/providers/paystack/adapter", () => ({
  paystackPaymentProvider: mockedPaystackProvider,
  verifyPaystackSignature: () => true,
}));
vi.mock("../../../../../../../modules/payments/router", () => ({ getActivePaymentProvider: () => mockedPaystackProvider }));

vi.mock("../../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../../modules/identity/policy";
const { POST } = await import("./route");

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: "Test", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function request(body: unknown) {
  return new Request("http://localhost/api/v1/orders/x/payments/mobile-money", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/orders/[id]/payments/mobile-money", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdCartIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeEach(() => {
    initiate.mockReset();
  });

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.cartItem.deleteMany({ where: { cartId: { in: createdCartIds } } });
    await prisma.cart.deleteMany({ where: { id: { in: createdCartIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function setupPendingOrder(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `MoMo Vendor ${label}`, storefrontSlug: `momo-vendor-${label}-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `MoMo Category ${label}`, slug: `momo-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "MoMo Listing", description: "Fixture.", basePrice: 40, moq: 1, availableQuantity: 10, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `momo-user-${label}-${suffix}`, name: `MoMo ${label}`, email: `momo.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `MoMo ${label}` } });
    const order = await prisma.order.create({
      data: {
        orderNumber: `MOMO-${suffix}`,
        customerProfileId: profile.id,
        subtotal: 40,
        total: 40,
        deliveryInfo: { recipientName: "X", phone: "0244000000", addressLine1: "1 St", city: "Accra", region: "Greater Accra" },
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
        items: { create: { listingId: listing.id, vendorId: vendor.id, description: "MoMo Listing", quantity: 1, unitPrice: 40, vendorPayableBasis: 30, lineTotal: 40 } },
      },
    });
    createdOrderIds.push(order.id);
    return { userId: user.id, orderId: order.id };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(request({ network: "MTN", phone: "0244123456" }), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("rejects an invalid network", async () => {
    const { userId, orderId } = await setupPendingOrder("bad-network");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request({ network: "VODAFONE", phone: "0244123456" }), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(422);
  });

  it("rejects initiating payment for another customer's order (IDOR)", async () => {
    const { orderId } = await setupPendingOrder("idor");
    const otherUser = await prisma.user.create({ data: { id: `momo-other-${Date.now()}`, name: "Other", email: `momo.other.${Date.now()}@example.com` } });
    createdUserIds.push(otherUser.id);
    await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(otherUser.id));
    const response = await POST(request({ network: "MTN", phone: "0244123456" }), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(422);
    expect(initiate).not.toHaveBeenCalled();
  });

  it("initiates a real payment via the Paystack provider and returns the Money-shaped status DTO", async () => {
    const { userId, orderId } = await setupPendingOrder("happy");
    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-momo-1", providerStatus: "pay_offline" });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request({ network: "MTN", phone: "0244123456" }), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("PENDING");
    expect(body.data.amount).toEqual({ amount: "40.00", currency: "GHS" });
    expect(initiate.mock.calls[0]?.[0]).toMatchObject({ amount: 40, currency: "GHS", network: "MTN" });
  });
});
