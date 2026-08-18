import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { ordersService } from "../orders/service";
import type { DeliveryInfo } from "../orders/types";

const verify = vi.fn();
const parseWebhook = vi.fn();
const initiatePaystackCardPayment = vi.fn();

vi.mock("./providers/paystack/adapter", () => ({
  paystackPaymentProvider: {
    name: "PAYSTACK" as const,
    initiate: vi.fn(),
    verify: (...args: unknown[]) => verify(...args),
    parseWebhook: (...args: unknown[]) => parseWebhook(...args),
  },
  initiatePaystackCardPayment: (...args: unknown[]) => initiatePaystackCardPayment(...args),
  verifyPaystackSignature: () => true,
}));

// Pins only the two fields this suite's determinism depends on
// (PAYSTACK_SECRET_KEY's mere presence gates card initiation;
// NEXT_PUBLIC_APP_URL feeds the callback_url) — every other field keeps its
// real, already-valid value, so this test's outcome never depends on which
// provider happens to be "active" in the local .env (the exact anti-pattern
// this session's refund-executor regression already taught: never let test
// behavior depend on ambient env state).
vi.mock("../../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/env")>();
  return {
    ...actual,
    env: { ...actual.env, PAYSTACK_SECRET_KEY: "sk_test_fixture_secret", NEXT_PUBLIC_APP_URL: "https://app.example.test" },
  };
});

const { paymentsService } = await import("./service");

const deliveryInfo: DeliveryInfo = {
  recipientName: "Test Recipient",
  phone: "0244000000",
  addressLine1: "1 Test Street",
  city: "Accra",
  region: "Greater Accra",
};

/** Integration tests against the real local Postgres dev database, with the Paystack HTTP boundary mocked at the adapter (M10B — card acceptance). */
describe("paymentsService — card payments (M10B, Paystack-hosted Checkout)", () => {
  let categoryId: string;
  let customerId: string;

  const createdOrderIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(() => {
    verify.mockReset();
    parseWebhook.mockReset();
    initiatePaystackCardPayment.mockReset();
  });

  async function setupCustomer() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "Card Test Category", slug: `card-test-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const user = await prisma.user.create({ data: { id: `card-test-user-${suffix}`, name: "Card Test User", email: `card.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "Card Test User" } });
    customerId = customer.id;
    createdCustomerIds.push(customer.id);
    return user;
  }

  afterAll(async () => {
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function createVendor(suffix: string) {
    const vendor = await prisma.vendor.create({ data: { companyName: `Card Vendor ${suffix}`, storefrontSlug: `card-vendor-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    return vendor.id;
  }

  async function createPendingOrder(vendorIds: string[], basePrice = 50, quantity = 1) {
    const cart = await prisma.cart.create({ data: { customerProfileId: customerId } });
    for (const vendorId of vendorIds) {
      const listing = await prisma.vendorListing.create({
        data: { vendorId, categoryId, title: "Card Test Listing", description: "Fixture.", basePrice, moq: 1, availableQuantity: 20, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
      });
      createdListingIds.push(listing.id);
      await prisma.cartItem.create({ data: { cartId: cart.id, listingId: listing.id, quantity } });
    }
    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    if (!result.ok) throw new Error(result.error);
    createdOrderIds.push(result.value.orderId);
    return result.value.orderId;
  }

  it("initiates a card payment with server-derived amount/currency/email and a server-generated callback_url, returning the authorization_url for redirect", async () => {
    await setupCustomer();
    const vendorId = await createVendor("a");
    const orderId = await createPendingOrder([vendorId], 85);

    initiatePaystackCardPayment.mockResolvedValueOnce({ outcome: "REDIRECT", authorizationUrl: "https://checkout.paystack.com/abc123" });
    const result = await paymentsService.initiateCardPayment({ customerProfileId: customerId, orderId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.authorizationUrl).toBe("https://checkout.paystack.com/abc123");
    expect(result.value.payment.method).toBe("CARD");
    expect(result.value.payment.network).toBeNull();

    expect(initiatePaystackCardPayment.mock.calls[0]?.[0]).toMatchObject({ amount: 85, currency: "GHS" });
    expect(initiatePaystackCardPayment.mock.calls[0]?.[0]?.callbackUrl).toBe(`https://app.example.test/checkout/${orderId}/payment/callback`);

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment?.provider).toBe("PAYSTACK");
    expect(payment?.method).toBe("CARD");
    expect(payment?.network).toBeNull();
    expect(payment?.status).toBe("PENDING");
  });

  it("rejects initiation for an Order owned by a different customer (IDOR)", async () => {
    await setupCustomer();
    const vendorId = await createVendor("idor");
    const orderId = await createPendingOrder([vendorId]);

    const otherUser = await prisma.user.create({ data: { id: `card-other-${Date.now()}`, name: "Other", email: `card.other.${Date.now()}@example.com` } });
    createdUserIds.push(otherUser.id);
    const otherCustomer = await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other" } });
    createdCustomerIds.push(otherCustomer.id);

    const result = await paymentsService.initiateCardPayment({ customerProfileId: otherCustomer.id, orderId });
    expect(result.ok).toBe(false);
    expect(initiatePaystackCardPayment).not.toHaveBeenCalled();
  });

  it("cross-method idempotency: an active Mobile Money attempt blocks a new Card attempt on the same Order (only one active Payment per Order)", async () => {
    await setupCustomer();
    const vendorId = await createVendor("cross-method");
    const orderId = await createPendingOrder([vendorId], 60);

    await prisma.payment.create({
      data: { orderId, reference: `PAY-CROSS-${Date.now()}`, provider: "PAYSTACK", method: "MOBILE_MONEY", network: "MTN", amount: 60, currency: "GHS", status: "PENDING" },
    });

    const result = await paymentsService.initiateCardPayment({ customerProfileId: customerId, orderId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.authorizationUrl).toBeNull(); // resumed, no fresh redirect URL available
    expect(result.value.payment.method).toBe("MOBILE_MONEY");
    expect(initiatePaystackCardPayment).not.toHaveBeenCalled();

    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(1); // no second Payment row was created
  });

  it("a rejected card initiation marks the Payment FAILED and never leaves a phantom active attempt", async () => {
    await setupCustomer();
    const vendorId = await createVendor("rejected");
    const orderId = await createPendingOrder([vendorId], 40);

    initiatePaystackCardPayment.mockResolvedValueOnce({ outcome: "REJECTED", reasonSafe: "Simulated rejection", providerStatus: "HTTP_401" });
    const result = await paymentsService.initiateCardPayment({ customerProfileId: customerId, orderId });
    expect(result.ok).toBe(false);

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment?.status).toBe("FAILED");
  });

  it("verifying a card payment's success stores safe brand/last4 display and confirms the Order — the exact same applyVerifyOutcome funnel as Mobile Money", async () => {
    await setupCustomer();
    const vendorId = await createVendor("succeed");
    const orderId = await createPendingOrder([vendorId], 85);

    initiatePaystackCardPayment.mockResolvedValueOnce({ outcome: "REDIRECT", authorizationUrl: "https://checkout.paystack.com/abc123" });
    const initiated = await paymentsService.initiateCardPayment({ customerProfileId: customerId, orderId });
    if (!initiated.ok) throw new Error("setup failed");

    verify.mockResolvedValue({
      status: "SUCCEEDED",
      providerReference: "card-tx-1",
      verifiedAmount: 85,
      verifiedCurrency: "GHS",
      providerStatus: "success",
      cardDisplay: { brand: "visa", last4: "4081" },
    });
    const statusResult = await paymentsService.getPaymentStatusForCustomer(initiated.value.payment.paymentId, customerId);
    expect(statusResult.ok).toBe(true);
    if (statusResult.ok) expect(statusResult.value.cardDisplay).toEqual({ brand: "visa", last4: "4081" });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CONFIRMED");
    const payment = await prisma.payment.findUnique({ where: { id: initiated.value.payment.paymentId } });
    expect(payment?.cardBrand).toBe("visa");
    expect(payment?.cardLast4).toBe("4081");
  });

  it("browser return (getCardReturnStatusForCustomer) never trusts the query-string reference alone — always independently re-verifies", async () => {
    await setupCustomer();
    const vendorId = await createVendor("return");
    const orderId = await createPendingOrder([vendorId], 70);

    initiatePaystackCardPayment.mockResolvedValueOnce({ outcome: "REDIRECT", authorizationUrl: "https://checkout.paystack.com/xyz" });
    const initiated = await paymentsService.initiateCardPayment({ customerProfileId: customerId, orderId });
    if (!initiated.ok) throw new Error("setup failed");

    // Even though this "return" carries the right reference, the outcome is
    // entirely determined by the independent verify() call, not by the
    // browser having arrived here at all.
    verify.mockResolvedValue({ status: "PENDING", providerStatus: "pending" });
    const pendingReturn = await paymentsService.getCardReturnStatusForCustomer({
      customerProfileId: customerId,
      orderId,
      reference: initiated.value.payment.reference,
    });
    expect(pendingReturn.ok).toBe(true);
    if (pendingReturn.ok) expect(pendingReturn.value.status).toBe("PENDING");
    expect(verify).toHaveBeenCalled();

    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "card-tx-2", verifiedAmount: 70, verifiedCurrency: "GHS", providerStatus: "success", cardDisplay: null });
    const succeededReturn = await paymentsService.getCardReturnStatusForCustomer({
      customerProfileId: customerId,
      orderId,
      reference: initiated.value.payment.reference,
    });
    expect(succeededReturn.ok).toBe(true);
    if (succeededReturn.ok) expect(succeededReturn.value.status).toBe("SUCCEEDED");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CONFIRMED");
  });

  it("getCardReturnStatusForCustomer is scoped to the authenticated customer's own order — never resolves another customer's Payment", async () => {
    await setupCustomer();
    const vendorId = await createVendor("return-idor");
    const orderId = await createPendingOrder([vendorId], 30);
    initiatePaystackCardPayment.mockResolvedValueOnce({ outcome: "REDIRECT", authorizationUrl: "https://checkout.paystack.com/idor" });
    const initiated = await paymentsService.initiateCardPayment({ customerProfileId: customerId, orderId });
    if (!initiated.ok) throw new Error("setup failed");

    const otherUser = await prisma.user.create({ data: { id: `card-return-other-${Date.now()}`, name: "Other", email: `card.return.other.${Date.now()}@example.com` } });
    createdUserIds.push(otherUser.id);
    const otherCustomer = await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other" } });
    createdCustomerIds.push(otherCustomer.id);

    const result = await paymentsService.getCardReturnStatusForCustomer({
      customerProfileId: otherCustomer.id,
      orderId,
      reference: initiated.value.payment.reference,
    });
    expect(result.ok).toBe(false);
  });
});
