import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { ordersService } from "../orders/service";
import type { DeliveryInfo } from "../orders/types";

// Pinned so this suite's outcome never depends on ambient .env values —
// VENDOR_PAYOUT_HOLD_HOURS matches service.test.ts's own convention;
// PAYMENT_PROVIDER="paystack" is required for initiatePayout's own gate.
vi.mock("../../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/env")>();
  return { ...actual, env: { ...actual.env, VENDOR_PAYOUT_HOLD_HOURS: 24, PAYMENT_PROVIDER: "paystack" } };
});

const resolveRecipient = vi.fn();
const initiate = vi.fn();
const verify = vi.fn();
vi.mock("./paystack-payout-provider", () => ({
  paystackPayoutProvider: {
    name: "PAYSTACK",
    resolveRecipient: (...args: unknown[]) => resolveRecipient(...args),
    initiate: (...args: unknown[]) => initiate(...args),
    verify: (...args: unknown[]) => verify(...args),
  },
}));

const { vendorFinanceService } = await import("./service");

const deliveryInfo: DeliveryInfo = {
  recipientName: "Test Recipient",
  phone: "0244000000",
  addressLine1: "1 Test Street",
  city: "Accra",
  region: "Greater Accra",
};

/** Integration tests against the real local Postgres dev database, with the Paystack HTTP boundary mocked at the payout-provider module (same discipline as modules/payments/paystack.service.test.ts). */
describe("vendorFinanceService — M12 automated Paystack payout", () => {
  let categoryId: string;
  let customerId: string;

  const createdOrderIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(() => {
    resolveRecipient.mockReset();
    initiate.mockReset();
    verify.mockReset();
    resolveRecipient.mockResolvedValue({ ok: true, value: "RCP_test_default" });
  });

  async function setupCustomer() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "Payout Test Category", slug: `payout-test-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const user = await prisma.user.create({ data: { id: `payout-test-user-${suffix}`, name: "Payout Test User", email: `payout.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "Payout Test User" } });
    customerId = customer.id;
    createdCustomerIds.push(customer.id);
  }

  afterAll(async () => {
    await prisma.vendorFinancialAdjustment.deleteMany({ where: { vendorEarning: { orderId: { in: createdOrderIds } } } });
    await prisma.vendorSettlementItem.deleteMany({ where: { vendorEarning: { orderId: { in: createdOrderIds } } } });
    await prisma.vendorSettlement.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendorEarning.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.vendorPayoutDestination.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
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
    const vendor = await prisma.vendor.create({ data: { companyName: `Payout Vendor ${suffix}`, storefrontSlug: `payout-vendor-${suffix}-${Date.now()}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    return vendor.id;
  }

  async function createConfirmedOrder(vendorId: string, basePrice = 100) {
    const cart = await prisma.cart.create({ data: { customerProfileId: customerId } });
    const listing = await prisma.vendorListing.create({
      data: { vendorId, categoryId, title: "Payout Test Listing", description: "Fixture.", basePrice, moq: 1, availableQuantity: 20, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);
    await prisma.cartItem.create({ data: { cartId: cart.id, listingId: listing.id, quantity: 1 } });
    const created = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    if (!created.ok) throw new Error(created.error);
    createdOrderIds.push(created.value.orderId);
    await ordersService.confirmOrderPayment(created.value.orderId);
    return created.value.orderId;
  }

  async function markDelivered(orderId: string, vendorId: string, hoursAgo: number) {
    const fulfilment = await prisma.fulfilment.findFirstOrThrow({ where: { orderId, vendorId } });
    const deliveredAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    await prisma.fulfilment.update({ where: { id: fulfilment.id }, data: { status: "DELIVERED" } });
    await prisma.shipment.updateMany({ where: { fulfilmentId: fulfilment.id }, data: { status: "DELIVERED", deliveredAt } });
    await prisma.vendorEarning.updateMany({ where: { fulfilmentId: fulfilment.id, status: "PENDING" }, data: { status: "WAITING_PERIOD", deliveredAt } });
    return fulfilment.id;
  }

  /** Full setup: confirmed+delivered order -> eligible earning -> APPROVED settlement with a Mobile Money destination snapshot. */
  async function setupApprovedSettlement(suffix: string, basePrice = 120) {
    await setupCustomer();
    const vendorId = await createVendor(suffix);
    const orderId = await createConfirmedOrder(vendorId, basePrice);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "OWNER", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Original Vendor",
      momoPhone: "0244111111",
      momoNetwork: "MTN",
    });

    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    const created = await vendorFinanceService.createSettlement(vendorId, eligible.map((e) => e.id));
    if (!created.ok) throw new Error("setup failed: " + created.error);
    await vendorFinanceService.approveSettlement(created.value.settlementId, "admin-1");

    const orderIdOut = orderId;
    return { vendorId, orderId: orderIdOut, settlementId: created.value.settlementId };
  }

  it("1. an approved settlement can have its payout initiated, and success -> PAID", async () => {
    const { settlementId, orderId, vendorId } = await setupApprovedSettlement("basic");
    initiate.mockResolvedValueOnce({ status: "PAID", providerReference: "PSK-REF-1", transferCode: "TRF_1" });

    const result = await vendorFinanceService.initiatePayout(settlementId, "admin-1");
    expect(result.ok).toBe(true);

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.status).toBe("PAID");
    expect(settlement.payoutProvider).toBe("PAYSTACK");
    expect(settlement.payoutProviderTransferCode).toBe("TRF_1");

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("PAID");
  });

  it("4. sends the settlement's authoritative net amount to the provider, never a larger/different value", async () => {
    const { settlementId } = await setupApprovedSettlement("amount", 250);
    initiate.mockResolvedValueOnce({ status: "PROCESSING", transferCode: null });
    const settlementBefore = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });

    await vendorFinanceService.initiatePayout(settlementId, "admin-1");

    expect(initiate).toHaveBeenCalledWith(expect.objectContaining({ amount: settlementBefore.netAmount.toNumber() }));
  });

  it("5 & 17. resolves the recipient from the settlement's own destination SNAPSHOT — a later Vendor destination change never affects it", async () => {
    const { settlementId, vendorId } = await setupApprovedSettlement("snapshot-payout");

    // Vendor changes their current destination AFTER approval.
    await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "OWNER", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Changed Vendor",
      momoPhone: "0244222222",
      momoNetwork: "MTN",
    });

    initiate.mockResolvedValueOnce({ status: "PROCESSING", transferCode: null });
    await vendorFinanceService.initiatePayout(settlementId, "admin-1");

    expect(resolveRecipient).toHaveBeenCalledWith(
      expect.objectContaining({ destination: expect.objectContaining({ momoAccountName: "Original Vendor", momoPhone: "0244111111" }) }),
    );
  });

  it("6. provider PROCESSING outcome leaves the settlement PROCESSING, earnings not yet PAID", async () => {
    const { settlementId, orderId, vendorId } = await setupApprovedSettlement("processing");
    initiate.mockResolvedValueOnce({ status: "PROCESSING", transferCode: "TRF_pending" });

    const result = await vendorFinanceService.initiatePayout(settlementId, "admin-1");
    expect(result.ok).toBe(true);

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.status).toBe("PROCESSING");
    expect(settlement.payoutProviderTransferCode).toBe("TRF_pending");

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("INCLUDED_IN_SETTLEMENT");
  });

  it("8. provider FAILED outcome -> FAILED, never PAID, earnings stay INCLUDED_IN_SETTLEMENT (not silently reverted)", async () => {
    const { settlementId, orderId, vendorId } = await setupApprovedSettlement("failed");
    initiate.mockResolvedValueOnce({ status: "FAILED", reasonSafe: "Paystack reported this transfer as failed." });

    const result = await vendorFinanceService.initiatePayout(settlementId, "admin-1");
    expect(result.ok).toBe(false);

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.status).toBe("FAILED");
    expect(settlement.payoutFailureReasonSafe).toBe("Paystack reported this transfer as failed.");

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("INCLUDED_IN_SETTLEMENT");
  });

  it("9 & 10. a double-click / concurrent Send Payout can only ever initiate one real transfer", async () => {
    const { settlementId } = await setupApprovedSettlement("double-click");
    initiate.mockResolvedValue({ status: "PROCESSING", transferCode: null });

    const [first, second] = await Promise.all([
      vendorFinanceService.initiatePayout(settlementId, "admin-1"),
      vendorFinanceService.initiatePayout(settlementId, "admin-1"),
    ]);
    expect([first.ok, second.ok].filter(Boolean).length).toBe(1);
    expect(initiate).toHaveBeenCalledTimes(1);
  });

  it("11. a duplicate webhook for an already-resolved settlement is a no-op (never re-verifies, never re-pays)", async () => {
    const { settlementId } = await setupApprovedSettlement("dup-webhook");
    initiate.mockResolvedValueOnce({ status: "PAID", providerReference: "PSK-REF-2", transferCode: "TRF_2" });
    await vendorFinanceService.initiatePayout(settlementId, "admin-1");

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.status).toBe("PAID");

    verify.mockClear();
    await vendorFinanceService.handlePaystackTransferWebhook({ event: "transfer.success", data: { reference: settlement.payoutProviderReference } });
    expect(verify).not.toHaveBeenCalled();

    const after = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(after.status).toBe("PAID");
    expect(after.payoutPaidAt?.getTime()).toBe(settlement.payoutPaidAt?.getTime());
  });

  it("12. a webhook can never mutate a settlement it doesn't reference — unknown reference is silently ignored", async () => {
    const { settlementId } = await setupApprovedSettlement("unrelated-webhook");
    initiate.mockResolvedValueOnce({ status: "PROCESSING", transferCode: null });
    await vendorFinanceService.initiatePayout(settlementId, "admin-1");

    await expect(vendorFinanceService.handlePaystackTransferWebhook({ event: "transfer.success", data: { reference: "some-other-unrelated-reference" } })).resolves.toBeUndefined();

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.status).toBe("PROCESSING"); // untouched
  });

  it("13. a FAILED payout can be safely retried, with a fresh reference, and can then succeed", async () => {
    const { settlementId, orderId, vendorId } = await setupApprovedSettlement("retry");
    initiate.mockResolvedValueOnce({ status: "FAILED", reasonSafe: "Paystack reported this transfer as failed." });
    await vendorFinanceService.initiatePayout(settlementId, "admin-1");
    const failedSettlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(failedSettlement.status).toBe("FAILED");
    const firstReference = failedSettlement.payoutProviderReference;

    initiate.mockResolvedValueOnce({ status: "PAID", providerReference: "PSK-REF-3", transferCode: "TRF_3" });
    const retryResult = await vendorFinanceService.initiatePayout(settlementId, "admin-1");
    expect(retryResult.ok).toBe(true);

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.status).toBe("PAID");
    expect(settlement.payoutProviderReference).not.toBe(firstReference);

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("PAID");
  });

  it("14. an uncertain (network/timeout) outcome leaves the settlement PROCESSING and CANNOT be blindly retried via Send Payout", async () => {
    const { settlementId } = await setupApprovedSettlement("uncertain");
    initiate.mockResolvedValueOnce({ status: "UNKNOWN" });
    await vendorFinanceService.initiatePayout(settlementId, "admin-1");

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.status).toBe("PROCESSING");

    // Send Payout again while uncertain — must be refused, not silently start a second transfer.
    const secondAttempt = await vendorFinanceService.initiatePayout(settlementId, "admin-1");
    expect(secondAttempt.ok).toBe(false);
    expect(initiate).toHaveBeenCalledTimes(1);

    // The safe path is checkPayoutStatus, which re-verifies independently.
    verify.mockResolvedValueOnce({ status: "PAID", providerReference: "PSK-REF-4", transferCode: "TRF_4" });
    const checked = await vendorFinanceService.checkPayoutStatus(settlementId);
    expect(checked.ok).toBe(true);
    const resolved = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(resolved.status).toBe("PAID");
  });

  it("15. manual 'Record External Payout' cannot be used once an automated payout is in flight", async () => {
    const { settlementId } = await setupApprovedSettlement("manual-conflict-processing");
    initiate.mockResolvedValueOnce({ status: "PROCESSING", transferCode: null });
    await vendorFinanceService.initiatePayout(settlementId, "admin-1");

    const manual = await vendorFinanceService.recordPayout(settlementId, { method: "MOBILE_MONEY", externalReference: "MANUAL-1", paidAt: new Date().toISOString(), note: "" }, "admin-1");
    expect(manual.ok).toBe(false);

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.status).toBe("PROCESSING");
  });

  it("16. an automated 'Send Payout' cannot execute against an already manually-paid settlement", async () => {
    const { settlementId } = await setupApprovedSettlement("manual-conflict-paid");
    const manual = await vendorFinanceService.recordPayout(settlementId, { method: "MOBILE_MONEY", externalReference: "MANUAL-2", paidAt: new Date().toISOString(), note: "" }, "admin-1");
    expect(manual.ok).toBe(true);

    const automated = await vendorFinanceService.initiatePayout(settlementId, "admin-1");
    expect(automated.ok).toBe(false);
    expect(initiate).not.toHaveBeenCalled();

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId } });
    expect(settlement.status).toBe("PAID");
    expect(settlement.payoutProvider).toBeNull(); // recorded manually, never touched by the automated path
  });

  it("18. an adjusted settlement pays its NET amount (post-adjustment), never the earning's original amount", async () => {
    await setupCustomer();
    const vendorId = await createVendor("adjusted-payout");
    const orderId = await createConfirmedOrder(vendorId, 500);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "OWNER", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Adjusted Vendor",
      momoPhone: "0244333333",
      momoNetwork: "MTN",
    });

    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    const earning = eligible[0]!;
    expect(earning.originalPayableAmount).toBeGreaterThan(100);

    await vendorFinanceService.createManualAdjustment({ vendorId, vendorEarningId: earning.id, amount: -100, reason: "Test correction", actorUserId: "admin-1" });

    const created = await vendorFinanceService.createSettlement(vendorId, [earning.id]);
    if (!created.ok) throw new Error("setup failed: " + created.error);
    const settlementRow = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: created.value.settlementId } });
    expect(settlementRow.netAmount.toNumber()).toBe(earning.originalPayableAmount - 100);
    await vendorFinanceService.approveSettlement(created.value.settlementId, "admin-1");

    initiate.mockResolvedValueOnce({ status: "PROCESSING", transferCode: null });
    await vendorFinanceService.initiatePayout(created.value.settlementId, "admin-1");

    expect(initiate).toHaveBeenCalledWith(expect.objectContaining({ amount: earning.originalPayableAmount - 100 }));
  });
});
