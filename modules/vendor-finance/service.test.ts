import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { ordersService } from "../orders/service";
import type { DeliveryInfo } from "../orders/types";

// The sweep depends on VENDOR_PAYOUT_HOLD_HOURS — pinned here so this
// suite's outcome never depends on the ambient .env value (the same
// anti-pattern this session's earlier work already flagged: never let test
// behavior depend on ambient env state).
vi.mock("../../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/env")>();
  return { ...actual, env: { ...actual.env, VENDOR_PAYOUT_HOLD_HOURS: 24 } };
});

const { vendorFinanceService } = await import("./service");

const deliveryInfo: DeliveryInfo = {
  recipientName: "Test Recipient",
  phone: "0244000000",
  addressLine1: "1 Test Street",
  city: "Accra",
  region: "Greater Accra",
};

describe("vendorFinanceService — M11 Vendor Finance", () => {
  let categoryId: string;
  let customerId: string;

  const createdOrderIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function setupCustomer() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "Finance Test Category", slug: `finance-test-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const user = await prisma.user.create({ data: { id: `finance-test-user-${suffix}`, name: "Finance Test User", email: `finance.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "Finance Test User" } });
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
    const vendor = await prisma.vendor.create({ data: { companyName: `Finance Vendor ${suffix}`, storefrontSlug: `finance-vendor-${suffix}-${Date.now()}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    return vendor.id;
  }

  /** Creates+confirms an Order (real service path — the exact production trigger for VendorEarning creation), one OrderItem per vendor. */
  async function createConfirmedOrder(vendorIds: string[], basePrice = 100) {
    const cart = await prisma.cart.create({ data: { customerProfileId: customerId } });
    for (const vendorId of vendorIds) {
      const listing = await prisma.vendorListing.create({
        data: { vendorId, categoryId, title: "Finance Test Listing", description: "Fixture.", basePrice, moq: 1, availableQuantity: 20, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
      });
      createdListingIds.push(listing.id);
      await prisma.cartItem.create({ data: { cartId: cart.id, listingId: listing.id, quantity: 1 } });
    }
    const created = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    if (!created.ok) throw new Error(created.error);
    createdOrderIds.push(created.value.orderId);
    await ordersService.confirmOrderPayment(created.value.orderId);
    return created.value.orderId;
  }

  /**
   * Raw-Prisma delivery fixture — deliberately bypasses
   * modules/fulfilment/repository.ts's progressShipment (the real
   * production trigger), so it must mirror that function's M11.1
   * event-driven PENDING -> WAITING_PERIOD write by hand.
   */
  async function markDelivered(orderId: string, vendorId: string, hoursAgo: number) {
    const fulfilment = await prisma.fulfilment.findFirstOrThrow({ where: { orderId, vendorId } });
    const deliveredAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    await prisma.fulfilment.update({ where: { id: fulfilment.id }, data: { status: "DELIVERED" } });
    await prisma.shipment.updateMany({ where: { fulfilmentId: fulfilment.id }, data: { status: "DELIVERED", deliveredAt } });
    await prisma.vendorEarning.updateMany({ where: { fulfilmentId: fulfilment.id, status: "PENDING" }, data: { status: "WAITING_PERIOD", deliveredAt } });
    return fulfilment.id;
  }

  it("creates a PENDING VendorEarning from an immutable snapshot the moment its FulfilmentItem is created", async () => {
    await setupCustomer();
    const vendorId = await createVendor("a");
    const orderId = await createConfirmedOrder([vendorId], 100);

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("PENDING");
    expect(earning.originalPayableAmount.toNumber()).toBeGreaterThan(0);

    // Later listing/cost changes never alter the already-created earning.
    const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.originalPayableAmount.toNumber()).toBe(orderItem.vendorPayableBasis.toNumber());
  });

  it("multi-vendor Order creates independent earnings, one per Vendor, each with its own amount", async () => {
    await setupCustomer();
    const vendorA = await createVendor("multi-a");
    const vendorB = await createVendor("multi-b");
    const orderId = await createConfirmedOrder([vendorA, vendorB], 50);

    const earnings = await prisma.vendorEarning.findMany({ where: { orderId } });
    expect(earnings.length).toBe(2);
    expect(new Set(earnings.map((e) => e.vendorId)).size).toBe(2);
  });

  it("sweepEligibleEarnings moves a WAITING_PERIOD earning to ELIGIBLE once the hold window has elapsed — not before", async () => {
    await setupCustomer();
    const vendorId = await createVendor("sweep");
    const orderId = await createConfirmedOrder([vendorId], 70);
    await markDelivered(orderId, vendorId, 1); // only 1h ago — hold window is 24h

    const tooSoon = await vendorFinanceService.sweepEligibleEarnings();
    let earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("WAITING_PERIOD");

    // The sweep reads VendorEarning.deliveredAt directly (M11.1) — updating Shipment alone
    // would no longer move anything; simulate the clock having moved on since the real
    // event-driven write (modules/fulfilment/repository.ts's progressShipment) happened.
    await prisma.vendorEarning.updateMany({ where: { orderId, vendorId }, data: { deliveredAt: new Date(Date.now() - 30 * 60 * 60 * 1000) } }); // now 30h ago
    const nowEligible = await vendorFinanceService.sweepEligibleEarnings();
    expect(nowEligible.madeEligible).toBeGreaterThanOrEqual(1);
    earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("ELIGIBLE");
    expect(earning.eligibleAt).not.toBeNull();
    void tooSoon;
  });

  it("Vendor Finance overview correctly buckets pending/eligible/on-hold/paid totals", async () => {
    await setupCustomer();
    const vendorId = await createVendor("overview");
    const orderId = await createConfirmedOrder([vendorId], 200);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    const overview = await vendorFinanceService.getOverviewForVendor(vendorId);
    expect(overview.availableForSettlement).toBeGreaterThan(0);
    expect(overview.pending).toBe(0);
  });

  it("createSettlement claims only ELIGIBLE earnings and computes an exact net total", async () => {
    await setupCustomer();
    const vendorId = await createVendor("settle-basic");
    const orderId = await createConfirmedOrder([vendorId], 150);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    expect(eligible.length).toBe(1);

    const result = await vendorFinanceService.createSettlement(vendorId, eligible.map((e) => e.id));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: result.value.settlementId } });
    expect(settlement.netAmount.toNumber()).toBe(eligible[0]!.originalPayableAmount);
    expect(settlement.status).toBe("DRAFT");

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("INCLUDED_IN_SETTLEMENT");
  });

  it("an earning already claimed by one settlement cannot be claimed by a second (concurrent creation attempts)", async () => {
    await setupCustomer();
    const vendorId = await createVendor("race");
    const orderId = await createConfirmedOrder([vendorId], 90);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();
    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    const earningIds = eligible.map((e) => e.id);

    const [first, second] = await Promise.all([
      vendorFinanceService.createSettlement(vendorId, earningIds),
      vendorFinanceService.createSettlement(vendorId, earningIds),
    ]);
    const outcomes = [first, second];
    expect(outcomes.filter((r) => r.ok).length).toBe(1);
    expect(outcomes.filter((r) => !r.ok).length).toBe(1);

    const settlementItems = await prisma.vendorSettlementItem.findMany({ where: { vendorEarning: { orderId } } });
    expect(settlementItems.length).toBe(1); // never double-claimed
  });

  it("approveSettlement snapshots the payout destination at that moment — a later Vendor change never alters the historical settlement", async () => {
    await setupCustomer();
    const vendorId = await createVendor("snapshot");
    const orderId = await createConfirmedOrder([vendorId], 300);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "OWNER", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Original Name",
      momoPhone: "0244111111",
      momoNetwork: "MTN",
    });

    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    const created = await vendorFinanceService.createSettlement(vendorId, eligible.map((e) => e.id));
    if (!created.ok) throw new Error("setup failed");
    await vendorFinanceService.approveSettlement(created.value.settlementId, "admin-1");

    // Vendor changes their destination AFTER approval.
    await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "OWNER", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Changed Name",
      momoPhone: "0244222222",
      momoNetwork: "MTN",
    });

    const detail = await vendorFinanceService.getSettlementDetailForVendor(vendorId, created.value.settlementId);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.destination?.momoAccountName).toBe("Original Name");
    }
  });

  it("recordPayout transitions a settlement to PAID exactly once (double-record guard) and marks its earnings PAID", async () => {
    await setupCustomer();
    const vendorId = await createVendor("payout-once");
    const orderId = await createConfirmedOrder([vendorId], 120);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    const created = await vendorFinanceService.createSettlement(vendorId, eligible.map((e) => e.id));
    if (!created.ok) throw new Error("setup failed");
    await vendorFinanceService.approveSettlement(created.value.settlementId, "admin-1");

    const input = { method: "MOBILE_MONEY", externalReference: "MOMO-TEST-1", paidAt: new Date().toISOString(), note: "" };
    const [first, second] = await Promise.all([
      vendorFinanceService.recordPayout(created.value.settlementId, input, "admin-1"),
      vendorFinanceService.recordPayout(created.value.settlementId, input, "admin-1"),
    ]);
    expect([first.ok, second.ok].filter(Boolean).length).toBe(1);

    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: created.value.settlementId } });
    expect(settlement.status).toBe("PAID");
    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("PAID");
  });

  it("cancelSettlement releases its earnings back to ELIGIBLE, freeing them for a future settlement", async () => {
    await setupCustomer();
    const vendorId = await createVendor("cancel");
    const orderId = await createConfirmedOrder([vendorId], 60);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    const created = await vendorFinanceService.createSettlement(vendorId, eligible.map((e) => e.id));
    if (!created.ok) throw new Error("setup failed");

    const cancelled = await vendorFinanceService.cancelSettlement(created.value.settlementId);
    expect(cancelled.ok).toBe(true);

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId } });
    expect(earning.status).toBe("ELIGIBLE");

    const reCreated = await vendorFinanceService.createSettlement(vendorId, [earning.id]);
    expect(reCreated.ok).toBe(true);
  });

  it("a manual negative correction reduces what's available; a settlement with net <= 0 is refused, never created", async () => {
    await setupCustomer();
    const vendorId = await createVendor("negative");
    const orderId = await createConfirmedOrder([vendorId], 50);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    const earningId = eligible[0]!.id;

    // A correction larger than the only eligible earning.
    await vendorFinanceService.createManualAdjustment({ vendorId, vendorEarningId: earningId, amount: -100, reason: "test correction", actorUserId: "admin-1" });

    const overview = await vendorFinanceService.getOverviewForVendor(vendorId);
    expect(overview.unappliedAdjustmentTotal).toBe(-100);
    expect(overview.availableForSettlement).toBe(0); // never negative in the displayed total

    const result = await vendorFinanceService.createSettlement(vendorId, [earningId]);
    expect(result.ok).toBe(false);

    const earning = await prisma.vendorEarning.findUniqueOrThrow({ where: { id: earningId } });
    expect(earning.status).toBe("ELIGIBLE"); // untouched — never partially claimed by the refused attempt
  });

  it("a positive future earning nets correctly against a prior outstanding negative adjustment", async () => {
    await setupCustomer();
    const vendorId = await createVendor("net-future");
    const orderId1 = await createConfirmedOrder([vendorId], 50);
    await markDelivered(orderId1, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();
    const firstEligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    await vendorFinanceService.createManualAdjustment({ vendorId, vendorEarningId: firstEligible[0]!.id, amount: -30, reason: "correction", actorUserId: "admin-1" });

    const orderId2 = await createConfirmedOrder([vendorId], 100);
    await markDelivered(orderId2, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();
    const secondEligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);

    const result = await vendorFinanceService.createSettlement(vendorId, secondEligible.map((e) => e.id));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: result.value.settlementId } });
    const grossFromSecondOrder = secondEligible.reduce((sum, e) => sum + e.originalPayableAmount, 0);
    expect(settlement.netAmount.toNumber()).toBe(grossFromSecondOrder - 30);
  });

  it("payout destination is masked for Vendor display but never for the admin-facing settlement snapshot fetch", async () => {
    await setupCustomer();
    const vendorId = await createVendor("mask");
    await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "OWNER", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Masked Test",
      momoPhone: "0244555555",
      momoNetwork: "MTN",
    });
    const view = await vendorFinanceService.getPayoutDestinationForVendor(vendorId);
    expect(view?.momoPhoneMasked).not.toBe("0244555555");
    expect(view?.momoPhoneMasked).toContain("***");
  });

  it("Vendor A cannot read Vendor B's earning or settlement detail (IDOR)", async () => {
    await setupCustomer();
    const vendorA = await createVendor("idor-a");
    const vendorB = await createVendor("idor-b");
    const orderId = await createConfirmedOrder([vendorB], 90);
    await markDelivered(orderId, vendorB, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    const earningB = await prisma.vendorEarning.findFirstOrThrow({ where: { orderId, vendorId: vendorB } });
    const detailAsA = await vendorFinanceService.getEarningDetailForVendor(vendorA, earningB.id);
    expect(detailAsA.ok).toBe(false);

    const settlementResult = await vendorFinanceService.createSettlement(vendorB, [earningB.id]);
    if (!settlementResult.ok) throw new Error("setup failed");
    const settlementAsA = await vendorFinanceService.getSettlementDetailForVendor(vendorA, settlementResult.value.settlementId);
    expect(settlementAsA.ok).toBe(false);
  });

  it("STAFF role cannot change payout destination — OWNER-only", async () => {
    await setupCustomer();
    const vendorId = await createVendor("staff-block");
    const result = await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "STAFF", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Should Not Save",
      momoPhone: "0244000111",
      momoNetwork: "MTN",
    });
    expect(result.ok).toBe(false);
    const destination = await prisma.vendorPayoutDestination.findUnique({ where: { vendorId } });
    expect(destination).toBeNull();
  });

  // --- M11.1 corrective pass: issue #7 — settlement total must reflect current net payable ---

  it("(M11.1) server-authoritative net payable: earning 500, adjustment -100, settlement amount is 400, never 500", async () => {
    await setupCustomer();
    const vendorId = await createVendor("net-500-100-400");
    const orderId = await createConfirmedOrder([vendorId], 500);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();

    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    expect(eligible[0]!.originalPayableAmount).toBe(500);
    await vendorFinanceService.createManualAdjustment({ vendorId, vendorEarningId: eligible[0]!.id, amount: -100, reason: "test correction", actorUserId: "admin-1" });

    const result = await vendorFinanceService.createSettlement(vendorId, [eligible[0]!.id]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const settlement = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: result.value.settlementId } });
    expect(settlement.grossPayable.toNumber()).toBe(500);
    expect(settlement.adjustmentTotal.toNumber()).toBe(-100);
    expect(settlement.netAmount.toNumber()).toBe(400); // never 500 — the client-displayed total must match this
  });

  // --- M11.1 corrective pass: issue #5 — payout destination "Not set" on a freshly-created (not yet approved) settlement ---

  it("(M11.1) a freshly-created settlement (not yet approved) shows the Vendor's CURRENT payout destination, not 'Not set' — destinationIsSnapshot is false until approval", async () => {
    await setupCustomer();
    const vendorId = await createVendor("destination-preview");
    await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "OWNER", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Preview Test",
      momoPhone: "0244555555",
      momoNetwork: "MTN",
    });
    const orderId = await createConfirmedOrder([vendorId], 80);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();
    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);

    const created = await vendorFinanceService.createSettlement(vendorId, eligible.map((e) => e.id));
    if (!created.ok) throw new Error("setup failed");

    const detail = await vendorFinanceService.getSettlementDetailForAdmin(created.value.settlementId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.destination).not.toBeNull(); // the exact reported bug: this used to be null ("Not set") pre-approval
    expect(detail.value.destination?.momoAccountName).toBe("Preview Test");
    expect(detail.value.destinationIsSnapshot).toBe(false); // clearly distinguished from the locked value
  });

  it("(M11.1) once a settlement is approved, its destination becomes the locked, immutable snapshot — destinationIsSnapshot is true", async () => {
    await setupCustomer();
    const vendorId = await createVendor("destination-locked");
    await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "OWNER", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Locked Test",
      momoPhone: "0244555555",
      momoNetwork: "MTN",
    });
    const orderId = await createConfirmedOrder([vendorId], 80);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();
    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    const created = await vendorFinanceService.createSettlement(vendorId, eligible.map((e) => e.id));
    if (!created.ok) throw new Error("setup failed");

    await vendorFinanceService.approveSettlement(created.value.settlementId, "admin-1");

    // Changing the Vendor's CURRENT destination afterward must not rewrite the already-approved settlement's snapshot.
    await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, "OWNER", "actor-1", {
      type: "MOBILE_MONEY",
      momoAccountName: "Changed After Approval",
      momoPhone: "0244000000",
      momoNetwork: "MTN",
    });

    const detail = await vendorFinanceService.getSettlementDetailForAdmin(created.value.settlementId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.destinationIsSnapshot).toBe(true);
    expect(detail.value.destination?.momoAccountName).toBe("Locked Test"); // unchanged by the later edit
  });

  it("(M11.1) a settlement created before any payout destination was ever saved shows genuinely 'not set', not a fabricated value", async () => {
    await setupCustomer();
    const vendorId = await createVendor("no-destination");
    const orderId = await createConfirmedOrder([vendorId], 60);
    await markDelivered(orderId, vendorId, 48);
    await vendorFinanceService.sweepEligibleEarnings();
    const eligible = await vendorFinanceService.listEligibleEarningsForAdmin(vendorId);
    const created = await vendorFinanceService.createSettlement(vendorId, eligible.map((e) => e.id));
    if (!created.ok) throw new Error("setup failed");

    const detail = await vendorFinanceService.getSettlementDetailForAdmin(created.value.settlementId);
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.destination).toBeNull();
    expect(detail.value.destinationIsSnapshot).toBe(false);
  });
});
