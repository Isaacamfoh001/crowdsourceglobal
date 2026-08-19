import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

// M11.1's release logic reads VENDOR_PAYOUT_HOLD_HOURS to decide
// WAITING_PERIOD vs ELIGIBLE on release — pinned here so this suite's
// outcome never depends on the ambient .env value (same pattern as
// modules/vendor-finance/service.test.ts).
vi.mock("../../lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/env")>();
  return { ...actual, env: { ...actual.env, VENDOR_PAYOUT_HOLD_HOURS: 24 } };
});

const { resolutionsService } = await import("./service");
const { vendorFinanceService } = await import("../vendor-finance/service");

/**
 * M11 — proves the M9 -> M11 wiring added to resolutionsRepository's
 * approveResolutionTransactional (hold + adjustment) and
 * resolutionsService.resolveCase (release), against the real local Postgres
 * dev database. Deliberately does not re-test M9's own refund/decision
 * logic (already covered by modules/resolutions/service.test.ts) — only the
 * new VendorEarning side effects.
 */
describe("resolutionsService — Vendor Finance integration (M11)", () => {
  let categoryId: string;
  let customerUserId: string;
  let customerProfileId: string;
  const createdIds = {
    categories: [] as string[],
    vendors: [] as string[],
    listings: [] as string[],
    users: [] as string[],
    customerProfiles: [] as string[],
    orders: [] as string[],
  };

  async function setup() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "VF Integration Category", slug: `vf-cat-${suffix}` } });
    categoryId = category.id;
    createdIds.categories.push(category.id);
    const user = await prisma.user.create({ data: { id: `vf-customer-${suffix}`, name: "VF Customer", email: `vf.customer.${suffix}@example.com` } });
    customerUserId = user.id;
    createdIds.users.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: customerUserId, displayName: "VF Customer" } });
    customerProfileId = customer.id;
    createdIds.customerProfiles.push(customer.id);
  }

  afterAll(async () => {
    await prisma.resolutionCaseItem.deleteMany({ where: { orderItem: { orderId: { in: createdIds.orders } } } });
    await prisma.resolutionCaseActivity.deleteMany({ where: { resolutionCase: { orderId: { in: createdIds.orders } } } });
    await prisma.refund.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.resolutionCase.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.vendorFinancialAdjustment.deleteMany({ where: { vendorId: { in: createdIds.vendors } } });
    await prisma.vendorSettlementItem.deleteMany({ where: { vendorEarning: { orderId: { in: createdIds.orders } } } });
    await prisma.vendorSettlement.deleteMany({ where: { vendorId: { in: createdIds.vendors } } });
    await prisma.vendorEarning.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdIds.orders } } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdIds.orders } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: createdIds.orders } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdIds.listings } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdIds.vendors } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdIds.customerProfiles } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
    await prisma.category.deleteMany({ where: { id: { in: createdIds.categories } } });
    await prisma.$disconnect();
  });

  async function createVendor(suffix: string) {
    const vendor = await prisma.vendor.create({ data: { companyName: `VF Vendor ${suffix}`, storefrontSlug: `vf-vendor-${suffix}-${Date.now()}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdIds.vendors.push(vendor.id);
    return vendor.id;
  }

  /** Builds a CONFIRMED, multi-vendor Order with real OrderItem/Fulfilment/FulfilmentItem/VendorEarning rows, bypassing checkout for test speed. */
  async function createConfirmedOrder(vendorPrices: { vendorId: string; unitPrice: number }[]) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-VF-${suffix}`,
        customerProfileId,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: vendorPrices.reduce((s, v) => s + v.unitPrice, 0),
        total: vendorPrices.reduce((s, v) => s + v.unitPrice, 0),
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "VF Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdIds.orders.push(order.id);

    const result: { orderItemId: string; fulfilmentItemId: string; vendorId: string }[] = [];
    for (const { vendorId, unitPrice } of vendorPrices) {
      const listing = await prisma.vendorListing.create({
        data: { title: "VF Listing", description: "Fixture.", basePrice: unitPrice, vendorId, categoryId, availableQuantity: 100, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
      });
      createdIds.listings.push(listing.id);
      const orderItem = await prisma.orderItem.create({
        data: { orderId: order.id, listingId: listing.id, vendorId, description: "VF Listing", quantity: 1, unitPrice, vendorPayableBasis: unitPrice * 0.7, lineTotal: unitPrice },
      });
      const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId, origin: "DOMESTIC_COLLECTION", status: "PREPARING" } });
      const fulfilmentItem = await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 1, unitPrice, vendorPayableBasis: unitPrice * 0.7 } });
      await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id } });
      await prisma.vendorEarning.create({
        data: { vendorId, orderId: order.id, fulfilmentId: fulfilment.id, fulfilmentItemId: fulfilmentItem.id, orderItemId: orderItem.id, currency: "GHS", originalPayableAmount: unitPrice * 0.7 },
      });
      result.push({ orderItemId: orderItem.id, fulfilmentItemId: fulfilmentItem.id, vendorId });
    }
    return { orderId: order.id, items: result };
  }

  it("a VENDOR-responsibility PARTIAL refund places ONLY that vendor's earning ON_HOLD and creates an exact negative adjustment — the other vendor in the same multi-vendor case is unaffected", async () => {
    await setup();
    const vendorA = await createVendor("hold-a");
    const vendorB = await createVendor("hold-b");
    const { orderId, items } = await createConfirmedOrder([
      { vendorId: vendorA, unitPrice: 100 },
      { vendorId: vendorB, unitPrice: 200 },
    ]);
    const itemA = items.find((i) => i.vendorId === vendorA)!;
    const itemB = items.find((i) => i.vendorId === vendorB)!;

    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: "ITEM_DAMAGED",
      description: "Damaged on arrival.",
      items: [
        { orderItemId: itemA.orderItemId, quantity: 1 },
        { orderItemId: itemB.orderItemId, quantity: 1 },
      ],
    });
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    const caseItemA = detail!.items.find((i) => i.orderItemId === itemA.orderItemId)!;
    const caseItemB = detail!.items.find((i) => i.orderItemId === itemB.orderItemId)!;

    // Only Vendor A's item is decided as refund-bearing (PARTIAL — the item still has
    // remaining value, so it goes ON_HOLD, not CANCELLED); Vendor B's item gets NO_ACTION.
    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [
        { caseItemId: caseItemA.id, approvedResolution: "PARTIAL_REFUND", approvedRefundAmount: 30 },
        { caseItemId: caseItemB.id, approvedResolution: "NO_ACTION" },
      ],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });

    const earningA = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: itemA.fulfilmentItemId } });
    expect(earningA.status).toBe("ON_HOLD");
    expect(earningA.holdReasonSafe).toBe("Order issue under review");

    const earningB = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: itemB.fulfilmentItemId } });
    expect(earningB.status).toBe("PENDING"); // completely unaffected

    const adjustment = await prisma.vendorFinancialAdjustment.findFirstOrThrow({ where: { vendorEarningId: earningA.id } });
    expect(adjustment.amount.toNumber()).toBe(-30);
    expect(adjustment.category).toBe("RESOLUTION_REFUND");

    const adjustmentsForB = await prisma.vendorFinancialAdjustment.count({ where: { vendorEarningId: earningB.id } });
    expect(adjustmentsForB).toBe(0);
  });

  it("a FULL_REFUND decision covering only PART of a multi-unit FulfilmentItem does NOT cancel the earning — it still carries unaffected remaining value", async () => {
    await setup();
    const vendorId = await createVendor("partial-closure");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-VF-${suffix}`,
        customerProfileId,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: 300,
        total: 300,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "VF Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdIds.orders.push(order.id);
    const listing = await prisma.vendorListing.create({
      data: { title: "VF Multi-Unit Listing", description: "Fixture.", basePrice: 100, vendorId, categoryId, availableQuantity: 100, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdIds.listings.push(listing.id);
    // 3 units purchased on ONE OrderItem/FulfilmentItem — a single VendorEarning covers all 3.
    const orderItem = await prisma.orderItem.create({
      data: { orderId: order.id, listingId: listing.id, vendorId, description: "VF Multi-Unit Listing", quantity: 3, unitPrice: 100, vendorPayableBasis: 70, lineTotal: 300 },
    });
    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId, origin: "DOMESTIC_COLLECTION", status: "PREPARING" } });
    const fulfilmentItem = await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 3, unitPrice: 100, vendorPayableBasis: 70 } });
    await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id } });
    await prisma.vendorEarning.create({
      data: { vendorId, orderId: order.id, fulfilmentId: fulfilment.id, fulfilmentItemId: fulfilmentItem.id, orderItemId: orderItem.id, currency: "GHS", originalPayableAmount: 70 },
    });

    // Only 1 of the 3 units is damaged — a full refund for THAT unit only.
    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "One of three units arrived damaged.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);

    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 100 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved — refund for the one damaged unit.",
    });

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: fulfilmentItem.id } });
    // NOT cancelled — the decision only covers 1 of the FulfilmentItem's 3 units, so it goes ON_HOLD (same as any partial), never CANCELLED.
    expect(earning.status).toBe("ON_HOLD");

    const adjustment = await prisma.vendorFinancialAdjustment.findFirstOrThrow({ where: { vendorEarningId: earning.id } });
    expect(adjustment.amount.toNumber()).toBe(-100);
  });

  it("a full VENDOR-responsibility refund with no replacement CANCELS the earning permanently — never left ON_HOLD, never restored by resolveCase", async () => {
    await setup();
    const vendorId = await createVendor("full-closure");
    const { orderId, items } = await createConfirmedOrder([{ vendorId, unitPrice: 100 }]);
    const item = items[0]!;

    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: "ITEM_DAMAGED",
      description: "Destroyed in transit — no replacement possible.",
      items: [{ orderItemId: item.orderItemId, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);

    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 100 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved — full refund, no replacement.",
    });

    let earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } });
    expect(earning.status).toBe("CANCELLED");
    expect(earning.heldForResolutionCaseId).toBeNull(); // never entered ON_HOLD in the first place

    const adjustment = await prisma.vendorFinancialAdjustment.findFirstOrThrow({ where: { vendorEarningId: earning.id } });
    expect(adjustment.amount.toNumber()).toBe(-100); // sized to the approved refund amount, same as any other resolution adjustment

    // resolveCase's release logic only ever targets ON_HOLD earnings — a CANCELLED one is untouched.
    await resolutionsService.resolveCase("staff-1", submitted.value.caseId);
    earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } });
    expect(earning.status).toBe("CANCELLED");
  });

  it("a CROWNSOURCE-responsibility refund never holds or adjusts the vendor's earning (no-fault refund)", async () => {
    await setup();
    const vendorId = await createVendor("crownsource");
    const { orderId, items } = await createConfirmedOrder([{ vendorId, unitPrice: 80 }]);
    const item = items[0]!;

    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: "PACKAGE_NOT_RECEIVED",
      description: "Courier lost it.",
      items: [{ orderItemId: item.orderItemId, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);

    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 56 }],
      responsibility: "CROWNSOURCE",
      customerSafeDecisionReason: "Approved — CrownSourceGlobal logistics issue.",
    });

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } });
    expect(earning.status).toBe("PENDING");
    const adjustments = await prisma.vendorFinancialAdjustment.count({ where: { vendorEarningId: earning.id } });
    expect(adjustments).toBe(0);
  });

  it("resolveCase releases an ON_HOLD earning that never delivered back to PENDING (fulfilment work is still genuinely outstanding)", async () => {
    await setup();
    const vendorId = await createVendor("release-pending");
    const { orderId, items } = await createConfirmedOrder([{ vendorId, unitPrice: 60 }]);
    const item = items[0]!;

    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: "WRONG_ITEM",
      description: "Wrong item sent.",
      items: [{ orderItemId: item.orderItemId, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "PARTIAL_REFUND", approvedRefundAmount: 20 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });

    let earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } });
    expect(earning.status).toBe("ON_HOLD");
    expect(earning.deliveredAt).toBeNull(); // this fixture's Fulfilment was never delivered

    await resolutionsService.resolveCase("staff-1", submitted.value.caseId);

    earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } });
    expect(earning.status).toBe("PENDING");
    expect(earning.heldForResolutionCaseId).toBeNull();
    // The adjustment created at approval remains — never erased by release.
    const adjustment = await prisma.vendorFinancialAdjustment.findFirstOrThrow({ where: { vendorEarningId: earning.id } });
    expect(adjustment.amount.toNumber()).toBe(-20);
  });

  it("resolveCase releases an ON_HOLD earning that HAD already delivered to WAITING_PERIOD, not PENDING — fulfilment work is not outstanding", async () => {
    await setup();
    const vendorId = await createVendor("release-waiting");
    const { orderId, items } = await createConfirmedOrder([{ vendorId, unitPrice: 60 }]);
    const item = items[0]!;

    // Simulate the earning having already entered its post-delivery waiting period recently.
    await prisma.vendorEarning.update({ where: { fulfilmentItemId: item.fulfilmentItemId }, data: { status: "WAITING_PERIOD", deliveredAt: new Date() } });

    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: "ITEM_NOT_AS_DESCRIBED",
      description: "Not as described.",
      items: [{ orderItemId: item.orderItemId, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "PARTIAL_REFUND", approvedRefundAmount: 15 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });

    let earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } });
    expect(earning.status).toBe("ON_HOLD");

    await resolutionsService.resolveCase("staff-1", submitted.value.caseId);

    earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } });
    expect(earning.status).toBe("WAITING_PERIOD"); // never PENDING — delivery already happened
  });

  it("resolveCase releases an ON_HOLD earning straight to ELIGIBLE when the hold window would already have elapsed since delivery", async () => {
    await setup();
    const vendorId = await createVendor("release-eligible");
    const { orderId, items } = await createConfirmedOrder([{ vendorId, unitPrice: 60 }]);
    const item = items[0]!;

    // Delivered well beyond the mocked 24h VENDOR_PAYOUT_HOLD_HOURS above.
    await prisma.vendorEarning.update({
      where: { fulfilmentItemId: item.fulfilmentItemId },
      data: { status: "WAITING_PERIOD", deliveredAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: "ITEM_NOT_AS_DESCRIBED",
      description: "Not as described.",
      items: [{ orderItemId: item.orderItemId, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "PARTIAL_REFUND", approvedRefundAmount: 10 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });

    await resolutionsService.resolveCase("staff-1", submitted.value.caseId);

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } });
    expect(earning.status).toBe("ELIGIBLE");
    expect(earning.eligibleAt).not.toBeNull();
  });

  it("a VENDOR-responsibility refund approved AFTER the earning is already PAID (post-settlement) creates a future negative adjustment and never alters the already-paid settlement", async () => {
    await setup();
    const vendorId = await createVendor("post-settlement");
    const { orderId, items } = await createConfirmedOrder([{ vendorId, unitPrice: 100 }]);
    const item = items[0]!;

    // Fast-forward this earning straight to PAID via a real settlement + payout.
    await prisma.vendorEarning.update({ where: { fulfilmentItemId: item.fulfilmentItemId }, data: { status: "ELIGIBLE", eligibleAt: new Date() } });
    const created = await vendorFinanceService.createSettlement(vendorId, [(await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } })).id]);
    if (!created.ok) throw new Error("setup failed");
    await vendorFinanceService.approveSettlement(created.value.settlementId, "admin-1");
    await vendorFinanceService.recordPayout(created.value.settlementId, { method: "MOBILE_MONEY", externalReference: "MOMO-PS-1", paidAt: new Date().toISOString(), note: "" }, "admin-1");

    const paidSettlementBefore = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: created.value.settlementId } });

    // A partial-quantity issue surfaces AFTER the vendor has already been paid.
    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: "ITEM_NOT_AS_DESCRIBED",
      description: "Partially not as described.",
      items: [{ orderItemId: item.orderItemId, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "PARTIAL_REFUND", approvedRefundAmount: 20 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved — partial refund.",
    });

    const earning = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentItemId: item.fulfilmentItemId } });
    expect(earning.status).toBe("PAID"); // never retroactively un-paid

    const adjustment = await prisma.vendorFinancialAdjustment.findFirstOrThrow({ where: { vendorEarningId: earning.id } });
    expect(adjustment.amount.toNumber()).toBe(-20);
    expect(adjustment.appliedToSettlementId).toBeNull(); // not yet swept into any settlement

    const paidSettlementAfter = await prisma.vendorSettlement.findUniqueOrThrow({ where: { id: created.value.settlementId } });
    expect(paidSettlementAfter.netAmount.toNumber()).toBe(paidSettlementBefore.netAmount.toNumber()); // untouched, historical
  });
});
