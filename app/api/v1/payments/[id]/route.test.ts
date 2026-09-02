// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";

vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: "Test", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

describe("GET /api/v1/payments/[id]", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdOrderIds: string[] = [];

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

  async function setupMockPayment(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `Poll Vendor ${label}`, storefrontSlug: `poll-vendor-${label}-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Poll Category ${label}`, slug: `poll-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Poll Listing", description: "Fixture.", basePrice: 15, moq: 1, availableQuantity: 10, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `poll-user-${label}-${suffix}`, name: `Poll ${label}`, email: `poll.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Poll ${label}` } });
    const order = await prisma.order.create({
      data: {
        orderNumber: `POLL-${suffix}`,
        customerProfileId: profile.id,
        subtotal: 15,
        total: 15,
        deliveryInfo: { recipientName: "X", phone: "0244000000", addressLine1: "1 St", city: "Accra", region: "Greater Accra" },
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
      },
    });
    createdOrderIds.push(order.id);
    // MOCK provider status never re-verifies against a live provider (see
    // paymentsService.getPaymentStatusForCustomer) — the simplest fixture
    // for exercising route wiring without mocking the Paystack adapter here.
    const payment = await prisma.payment.create({
      data: { orderId: order.id, reference: `poll-ref-${suffix}`, provider: "MOCK", method: "MOCK", amount: 15, currency: "GHS", status: "SUCCEEDED", confirmedAt: new Date() },
    });
    return { userId: user.id, paymentId: payment.id };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/payments/x"), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("returns NOT_FOUND for another customer's payment (IDOR), never leaking its status", async () => {
    const { paymentId } = await setupMockPayment("idor");
    const otherUser = await prisma.user.create({ data: { id: `poll-other-${Date.now()}`, name: "Other", email: `poll.other.${Date.now()}@example.com` } });
    createdUserIds.push(otherUser.id);
    await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(otherUser.id));
    const response = await GET(new Request("http://localhost/api/v1/payments/x"), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(404);
  });

  it("returns the Money-shaped status DTO for the owner", async () => {
    const { userId, paymentId } = await setupMockPayment("happy");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await GET(new Request("http://localhost/api/v1/payments/x"), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("SUCCEEDED");
    expect(body.data.amount).toEqual({ amount: "15.00", currency: "GHS" });
  });
});
