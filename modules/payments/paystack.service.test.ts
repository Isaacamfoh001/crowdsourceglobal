import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { ordersService } from "../orders/service";
import type { DeliveryInfo } from "../orders/types";

const initiate = vi.fn();
const verify = vi.fn();
const parseWebhook = vi.fn();

const mockedPaystackProvider = {
  name: "PAYSTACK" as const,
  initiate: (...args: unknown[]) => initiate(...args),
  verify: (...args: unknown[]) => verify(...args),
  parseWebhook: (...args: unknown[]) => parseWebhook(...args),
};

vi.mock("./providers/paystack/adapter", () => ({
  paystackPaymentProvider: mockedPaystackProvider,
  verifyPaystackSignature: () => true,
}));
// Paystack is the primary provider as of M10A.2 — this file forces it
// active explicitly rather than depending on the local .env's
// PAYMENT_PROVIDER value, matching the lesson learned from the refund
// executor routing regression (tests must never read ambient env state).
vi.mock("./router", () => ({ getActivePaymentProvider: () => mockedPaystackProvider }));

const { paymentsService } = await import("./service");

const deliveryInfo: DeliveryInfo = {
  recipientName: "Test Recipient",
  phone: "0244000000",
  addressLine1: "1 Test Street",
  city: "Accra",
  region: "Greater Accra",
};

/** Integration tests against the real local Postgres dev database, with the Paystack HTTP boundary mocked at the adapter. */
describe("paymentsService — Paystack (M10A.2)", () => {
  let categoryId: string;
  let customerId: string;

  const createdOrderIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(() => {
    initiate.mockReset();
    verify.mockReset();
    parseWebhook.mockReset();
  });

  async function setupCustomer() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "Paystack Test Category", slug: `paystack-test-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const user = await prisma.user.create({ data: { id: `paystack-test-user-${suffix}`, name: "Paystack Test User", email: `paystack.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "Paystack Test User" } });
    customerId = customer.id;
    createdCustomerIds.push(customer.id);
    return user;
  }

  afterAll(async () => {
    await prisma.vendorFinancialAdjustment.deleteMany({ where: { vendorEarning: { orderId: { in: createdOrderIds } } } });
    await prisma.vendorEarning.deleteMany({ where: { orderId: { in: createdOrderIds } } });
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
    const vendor = await prisma.vendor.create({ data: { companyName: `Paystack Vendor ${suffix}`, storefrontSlug: `paystack-vendor-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    return vendor.id;
  }

  async function createPendingOrder(vendorIds: string[], basePrice = 50, quantity = 1) {
    const cart = await prisma.cart.create({ data: { customerProfileId: customerId } });
    for (const vendorId of vendorIds) {
      const listing = await prisma.vendorListing.create({
        data: { vendorId, categoryId, title: "Paystack Test Listing", description: "Fixture.", basePrice, moq: 1, availableQuantity: 20, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
      });
      createdListingIds.push(listing.id);
      await prisma.cartItem.create({ data: { cartId: cart.id, listingId: listing.id, quantity } });
    }
    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    if (!result.ok) throw new Error(result.error);
    createdOrderIds.push(result.value.orderId);
    return result.value.orderId;
  }

  it("initiates a payment with server-derived amount/currency and the customer's own email, never client input", async () => {
    await setupCustomer();
    const vendorId = await createVendor("a");
    const orderId = await createPendingOrder([vendorId], 75);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "2009945086", providerStatus: "pay_offline" });
    const result = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });

    expect(result.ok).toBe(true);
    expect(initiate.mock.calls[0]?.[0]).toMatchObject({ amount: 75, currency: "GHS", network: "MTN" });
    expect(typeof initiate.mock.calls[0]?.[0]?.customerEmail).toBe("string");

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment?.provider).toBe("PAYSTACK");
    expect(payment?.status).toBe("PENDING");
    expect(payment?.providerReference).toBe("2009945086");
  });

  it("rejects initiation for an Order owned by a different customer (IDOR)", async () => {
    await setupCustomer();
    const vendorId = await createVendor("idor");
    const orderId = await createPendingOrder([vendorId]);

    const otherUser = await prisma.user.create({ data: { id: `paystack-other-${Date.now()}`, name: "Other", email: `paystack.other.${Date.now()}@example.com` } });
    createdUserIds.push(otherUser.id);
    const otherCustomer = await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other" } });
    createdCustomerIds.push(otherCustomer.id);

    const result = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: otherCustomer.id, orderId, network: "MTN", phone: "0244123456" });
    expect(result.ok).toBe(false);
    expect(initiate).not.toHaveBeenCalled();
  });

  it("rejects initiating a second payment for an already-CONFIRMED Order", async () => {
    await setupCustomer();
    const vendorId = await createVendor("paid");
    const orderId = await createPendingOrder([vendorId]);
    await prisma.order.update({ where: { id: orderId }, data: { status: "CONFIRMED", paymentStatus: "PAID" } });

    const result = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    expect(result.ok).toBe(false);
  });

  it("send_otp flow: OTP required, resubmitted against the same reference, then confirms on verified success", async () => {
    await setupCustomer();
    const vendorId = await createVendor("otp");
    const orderId = await createPendingOrder([vendorId], 60);

    initiate.mockResolvedValueOnce({ outcome: "OTP_REQUIRED", providerStatus: "send_otp" });
    const initiated = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");
    expect(initiated.value.requiresOtp).toBe(true);

    const referenceUsed = initiate.mock.calls[0]?.[0]?.reference;
    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "2009945087", providerStatus: "pay_offline" });
    const otpResult = await paymentsService.submitMobileMoneyOtp({ customerProfileId: customerId, paymentId: initiated.value.paymentId, phone: "0244123456", otpcode: "123456" });
    expect(otpResult.ok).toBe(true);
    expect(initiate.mock.calls[1]?.[0]?.reference).toBe(referenceUsed);
    expect(initiate.mock.calls[1]?.[0]?.otpcode).toBe("123456");

    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "2009945087", verifiedAmount: 60, verifiedCurrency: "GHS", providerStatus: "success" });
    await paymentsService.getPaymentStatusForCustomer(initiated.value.paymentId, customerId);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CONFIRMED");
  });

  it("multi-vendor: one Order, two Vendors, one Paystack payment, two Fulfilments after confirmation", async () => {
    await setupCustomer();
    const vendorA = await createVendor("multi-a");
    const vendorB = await createVendor("multi-b");
    const orderId = await createPendingOrder([vendorA, vendorB], 40);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-multi", providerStatus: "pay_offline" });
    const initiated = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-multi", verifiedAmount: order!.total.toNumber(), verifiedCurrency: "GHS", providerStatus: "success" });
    await paymentsService.getPaymentStatusForCustomer(initiated.value.paymentId, customerId);

    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(1);
    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(2);
  });

  it("retry: a failed attempt followed by a successful one confirms the order exactly once", async () => {
    await setupCustomer();
    const vendorId = await createVendor("retry");
    const orderId = await createPendingOrder([vendorId], 25);

    initiate.mockResolvedValueOnce({ outcome: "REJECTED", reasonSafe: "Simulated rejection", providerStatus: "failed" });
    const failedAttempt = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    expect(failedAttempt.ok).toBe(false);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-retry-2", providerStatus: "pay_offline" });
    const retry = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;

    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-retry-2", verifiedAmount: 25, verifiedCurrency: "GHS", providerStatus: "success" });
    await paymentsService.getPaymentStatusForCustomer(retry.value.paymentId, customerId);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CONFIRMED");
    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(2);
    expect(payments.filter((p) => p.status === "SUCCEEDED").length).toBe(1);
  });

  it("a forged/mismatched amount from the provider never confirms the Order", async () => {
    await setupCustomer();
    const vendorId = await createVendor("forged-amount");
    const orderId = await createPendingOrder([vendorId], 500);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-forged", providerStatus: "pay_offline" });
    const initiated = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-forged", verifiedAmount: 1, verifiedCurrency: "GHS", providerStatus: "success" });
    await paymentsService.getPaymentStatusForCustomer(initiated.value.paymentId, customerId);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("PENDING_PAYMENT");
    const payment = await prisma.payment.findUnique({ where: { id: initiated.value.paymentId } });
    expect(payment?.status).not.toBe("SUCCEEDED");
    expect(payment?.exceptionReason).toMatch(/mismatch/i);
  });

  it("duplicate webhook callbacks confirm the order exactly once (charge.success delivered 3 times)", async () => {
    await setupCustomer();
    const vendorId = await createVendor("dup-webhook");
    const orderId = await createPendingOrder([vendorId], 33);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-dup", providerStatus: "pay_offline" });
    const initiated = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    const paymentRow = await prisma.payment.findUniqueOrThrow({ where: { id: initiated.value.paymentId } });
    parseWebhook.mockReturnValue({ recognized: true, reference: paymentRow.reference, providerReference: "ref-dup", claimedSucceeded: true, sourceIpTrusted: true });
    verify.mockResolvedValue({ status: "SUCCEEDED", providerReference: "ref-dup", verifiedAmount: 33, verifiedCurrency: "GHS", providerStatus: "success" });

    await paymentsService.handlePaystackWebhook({}, "52.31.139.75");
    await paymentsService.handlePaystackWebhook({}, "52.31.139.75");
    await paymentsService.handlePaystackWebhook({}, "52.31.139.75");

    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(1);
    const succeededPayments = await prisma.payment.findMany({ where: { orderId, status: "SUCCEEDED" } });
    expect(succeededPayments.length).toBe(1);
  });

  it("the webhook body's claimed status alone is never sufficient — a claimed success with a verify() contradiction never confirms", async () => {
    await setupCustomer();
    const vendorId = await createVendor("forged-webhook");
    const orderId = await createPendingOrder([vendorId], 44);

    initiate.mockResolvedValueOnce({ outcome: "ACCEPTED", providerReference: "ref-forged-wh", providerStatus: "pay_offline" });
    const initiated = await paymentsService.initiateMobileMoneyPayment({ customerProfileId: customerId, orderId, network: "MTN", phone: "0244123456" });
    if (!initiated.ok) throw new Error("setup failed");

    const paymentRow = await prisma.payment.findUniqueOrThrow({ where: { id: initiated.value.paymentId } });
    // Webhook body CLAIMS success, but the independent verify() call says otherwise.
    parseWebhook.mockReturnValue({ recognized: true, reference: paymentRow.reference, providerReference: "ref-forged-wh", claimedSucceeded: true, sourceIpTrusted: true });
    verify.mockResolvedValue({ status: "PENDING", providerStatus: "pending" });

    await paymentsService.handlePaystackWebhook({}, "52.31.139.75");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("PENDING_PAYMENT");
  });
});
