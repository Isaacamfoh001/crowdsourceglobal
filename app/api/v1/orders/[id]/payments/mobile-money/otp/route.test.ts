// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../../../lib/db";

const initiate = vi.fn();
const verify = vi.fn();
const mockedPaystackProvider = {
  name: "PAYSTACK" as const,
  initiate: (...args: unknown[]) => initiate(...args),
  verify: (...args: unknown[]) => verify(...args),
  parseWebhook: vi.fn(),
};
vi.mock("../../../../../../../../modules/payments/providers/paystack/adapter", () => ({
  paystackPaymentProvider: mockedPaystackProvider,
  verifyPaystackSignature: () => true,
}));
vi.mock("../../../../../../../../modules/payments/router", () => ({ getActivePaymentProvider: () => mockedPaystackProvider }));

vi.mock("../../../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../../../modules/identity/policy";
const { POST } = await import("./route");

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: "Test", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function request(body: unknown) {
  return new Request("http://localhost/api/v1/orders/x/payments/mobile-money/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/orders/[id]/payments/mobile-money/otp", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeEach(() => {
    initiate.mockReset();
    verify.mockReset();
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

  async function setupOtpAwaitingPayment(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `Otp Vendor ${label}`, storefrontSlug: `otp-vendor-${label}-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Otp Category ${label}`, slug: `otp-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Otp Listing", description: "Fixture.", basePrice: 22, moq: 1, availableQuantity: 10, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `otp-user-${label}-${suffix}`, name: `Otp ${label}`, email: `otp.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Otp ${label}` } });
    const order = await prisma.order.create({
      data: {
        orderNumber: `OTP-${suffix}`,
        customerProfileId: profile.id,
        subtotal: 22,
        total: 22,
        deliveryInfo: { recipientName: "X", phone: "0244000000", addressLine1: "1 St", city: "Accra", region: "Greater Accra" },
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
      },
    });
    createdOrderIds.push(order.id);
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        reference: `otp-ref-${suffix}`,
        provider: "PAYSTACK",
        method: "MOBILE_MONEY",
        network: "MTN",
        amount: 22,
        currency: "GHS",
        status: "PENDING",
        providerStatus: "send_otp",
      },
    });
    return { userId: user.id, orderId: order.id, paymentId: payment.id };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(request({ paymentId: "x", phone: "0244123456", otpcode: "123456" }), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("rejects submitting an OTP for another customer's payment (IDOR)", async () => {
    const { paymentId } = await setupOtpAwaitingPayment("idor");
    const otherUser = await prisma.user.create({ data: { id: `otp-other-${Date.now()}`, name: "Other", email: `otp.other.${Date.now()}@example.com` } });
    createdUserIds.push(otherUser.id);
    await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(otherUser.id));
    const response = await POST(request({ paymentId, phone: "0244123456", otpcode: "123456" }), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(422);
    expect(initiate).not.toHaveBeenCalled();
  });

  it("resubmits the OTP against the same reference and returns the updated status", async () => {
    const { userId, orderId, paymentId } = await setupOtpAwaitingPayment("happy");
    const paymentBefore = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-otp-1", providerStatus: "pay_offline" });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request({ paymentId, phone: "0244123456", otpcode: "123456" }), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(200);
    expect(initiate.mock.calls[0]?.[0]).toMatchObject({ reference: paymentBefore.reference, otpcode: "123456" });

    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(updated.status).toBe("PENDING");
    expect(updated.providerReference).toBe("ref-otp-1");
  });

  it("rejects a missing otpcode", async () => {
    const { userId, orderId, paymentId } = await setupOtpAwaitingPayment("validation");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(userId));
    const response = await POST(request({ paymentId, phone: "0244123456", otpcode: "" }), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(422);
  });
});
