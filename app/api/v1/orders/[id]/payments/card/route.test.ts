// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../../lib/db";

const initiateCard = vi.fn();
vi.mock("../../../../../../../modules/payments/providers/paystack/adapter", () => ({
  paystackPaymentProvider: { name: "PAYSTACK", initiate: vi.fn(), verify: vi.fn(), parseWebhook: vi.fn() },
  initiatePaystackCardPayment: (...args: unknown[]) => initiateCard(...args),
  verifyPaystackSignature: () => true,
}));

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

function request() {
  return new Request("http://localhost/api/v1/orders/x/payments/card", { method: "POST" });
}

describe("POST /api/v1/orders/[id]/payments/card", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeEach(() => {
    initiateCard.mockReset();
  });

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function setupPendingOrder(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `Card Vendor ${label}`, storefrontSlug: `card-vendor-${label}-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Card Category ${label}`, slug: `card-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Card Listing", description: "Fixture.", basePrice: 90, moq: 1, availableQuantity: 10, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `card-user-${label}-${suffix}`, name: `Card ${label}`, email: `card.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Card ${label}` } });
    const order = await prisma.order.create({
      data: {
        orderNumber: `CARD-${suffix}`,
        customerProfileId: profile.id,
        subtotal: 90,
        total: 90,
        deliveryInfo: { recipientName: "X", phone: "0244000000", addressLine1: "1 St", city: "Accra", region: "Greater Accra" },
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
        items: { create: { listingId: listing.id, vendorId: vendor.id, description: "Card Listing", quantity: 1, unitPrice: 90, vendorPayableBasis: 60, lineTotal: 90 } },
      },
    });
    createdOrderIds.push(order.id);
    return { userId: user.id, orderId: order.id };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(request(), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("rejects initiating card payment for another customer's order (IDOR)", async () => {
    const { orderId } = await setupPendingOrder("idor");
    const otherUser = await prisma.user.create({ data: { id: `card-other-${Date.now()}`, name: "Other", email: `card.other.${Date.now()}@example.com` } });
    createdUserIds.push(otherUser.id);
    await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(otherUser.id));
    const response = await POST(request(), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(422);
    expect(initiateCard).not.toHaveBeenCalled();
  });

  it("initiates a card payment and returns the Paystack authorizationUrl, never a card form", async () => {
    const { userId, orderId } = await setupPendingOrder("happy");
    initiateCard.mockResolvedValueOnce({ outcome: "REDIRECT", authorizationUrl: "https://checkout.paystack.com/abc123" });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request(), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.authorizationUrl).toBe("https://checkout.paystack.com/abc123");
    expect(body.data.payment.method).toBe("CARD");
    expect(body.data.payment.amount).toEqual({ amount: "90.00", currency: "GHS" });
  });
});
