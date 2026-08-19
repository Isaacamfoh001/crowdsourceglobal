import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { quotationService } from "./service";
import { ordersService } from "../orders/service";
import * as emailProviderModule from "../../lib/email-provider";
import { processEmailQueue } from "../../lib/email-worker";
import type { DeliveryInfo } from "../orders/types";

const deliveryInfo: DeliveryInfo = {
  recipientName: "Ama Customer",
  phone: "0244111222",
  addressLine1: "5 Customer Close",
  city: "Accra",
  region: "Greater Accra",
};

/** Integration tests against the real local Postgres dev database. */
describe("quotationService / ordersService.createOrderFromQuotation", () => {
  let categoryId: string;
  let vendorAId: string;
  let vendorBId: string;
  let customerAId: string;
  let customerAUserId: string;
  let customerAEmail: string;
  let customerBId: string;

  const createdVendorIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdQuotationIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendorA = await prisma.vendor.create({
      data: { companyName: "M5 Vendor A", storefrontSlug: `m5-vendor-a-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    vendorAId = vendorA.id;
    createdVendorIds.push(vendorA.id);

    const vendorB = await prisma.vendor.create({
      data: { companyName: "M5 Vendor B", storefrontSlug: `m5-vendor-b-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    vendorBId = vendorB.id;
    createdVendorIds.push(vendorB.id);

    const category = await prisma.category.create({ data: { name: "M5 Test Category", slug: `m5-test-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const userA = await prisma.user.create({
      data: { id: `m5-customer-a-${suffix}`, name: "Customer A", email: `m5.customer.a.${suffix}@example.com` },
    });
    createdUserIds.push(userA.id);
    customerAUserId = userA.id;
    customerAEmail = userA.email;
    const customerA = await prisma.customerProfile.create({ data: { userId: userA.id, displayName: "Customer A" } });
    customerAId = customerA.id;
    createdCustomerIds.push(customerA.id);

    const userB = await prisma.user.create({
      data: { id: `m5-customer-b-${suffix}`, name: "Customer B", email: `m5.customer.b.${suffix}@example.com` },
    });
    createdUserIds.push(userB.id);
    const customerB = await prisma.customerProfile.create({ data: { userId: userB.id, displayName: "Customer B" } });
    customerBId = customerB.id;
    createdCustomerIds.push(customerB.id);
  });

  afterAll(async () => {
    await prisma.vendorFinancialAdjustment.deleteMany({ where: { vendorEarning: { orderId: { in: createdOrderIds } } } });
    await prisma.vendorEarning.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.quotationItem.deleteMany({ where: { quotationId: { in: createdQuotationIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: createdQuotationIds } } });
    await prisma.vendorCostRule.deleteMany({ where: { listingId: { in: createdListingIds } } });
    await prisma.bulkPriceTier.deleteMany({ where: { listingId: { in: createdListingIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function seedListing(options: {
    vendorId: string;
    basePrice: number;
    moq?: number;
    maxOq?: number;
    availableQuantity: number;
    vendorSupplyCost?: number;
    tiers?: { minQuantity: number; maxQuantity: number | null; unitPrice: number }[];
    approvalStatus?: "APPROVED" | "PENDING";
    listingStatus?: "ACTIVE" | "INACTIVE";
  }) {
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId: options.vendorId,
        categoryId,
        title: `M5 Listing ${Math.random().toString(36).slice(2, 8)}`,
        description: "Fixture.",
        basePrice: options.basePrice,
        moq: options.moq ?? 1,
        maxOq: options.maxOq,
        availableQuantity: options.availableQuantity,
        approvalStatus: options.approvalStatus ?? "APPROVED",
        listingStatus: options.listingStatus ?? "ACTIVE",
      },
    });
    createdListingIds.push(listing.id);

    if (options.vendorSupplyCost !== undefined) {
      await prisma.vendorCostRule.create({
        data: { listingId: listing.id, vendorSupplyCost: options.vendorSupplyCost, marginRuleType: "PERCENTAGE", marginValue: 30 },
      });
    }
    if (options.tiers) {
      await prisma.bulkPriceTier.createMany({
        data: options.tiers.map((tier) => ({ ...tier, listingId: listing.id })),
      });
    }

    return listing;
  }

  async function generate(customerProfileId: string, email: string, lines: { listingId: string; quantity: number }[]) {
    const result = await quotationService.generateFromDraft(customerProfileId, customerAUserId, email, lines);
    if (result.ok) createdQuotationIds.push(result.value.quotationId);
    return result;
  }

  // ---- Generation ----------------------------------------------------

  it("generates an instant quote with the correct bulk tier price", async () => {
    const listing = await seedListing({
      vendorId: vendorAId,
      basePrice: 300,
      availableQuantity: 500,
      tiers: [
        { minQuantity: 10, maxQuantity: 49, unitPrice: 280 },
        { minQuantity: 50, maxQuantity: 99, unitPrice: 250 },
        { minQuantity: 100, maxQuantity: null, unitPrice: 230 },
      ],
    });

    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 100 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const detail = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    expect(detail?.items[0]?.unitPrice).toBe(230);
    expect(detail?.total).toBe(23000);
    expect(detail?.status).toBe("ISSUED");
    expect(result.value.reference).toMatch(/^QT-\d{8}-[A-Z0-9]{5}$/);
  });

  it("rejects a quantity below MOQ", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 50, moq: 20, availableQuantity: 100 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 5 }]);
    expect(result.ok).toBe(false);
  });

  it("rejects a quantity above maxOq", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 50, maxOq: 10, availableQuantity: 100 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 20 }]);
    expect(result.ok).toBe(false);
  });

  it("rejects a PENDING (not-yet-approved) listing", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 50, availableQuantity: 100, approvalStatus: "PENDING" });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 5 }]);
    expect(result.ok).toBe(false);
  });

  it("rejects an INACTIVE listing", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 50, availableQuantity: 100, listingStatus: "INACTIVE" });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 5 }]);
    expect(result.ok).toBe(false);
  });

  it("supports multiple line items from the same vendor", async () => {
    const listingA = await seedListing({ vendorId: vendorAId, basePrice: 20, availableQuantity: 100 });
    const listingB = await seedListing({ vendorId: vendorAId, basePrice: 15, availableQuantity: 100 });

    const result = await generate(customerAId, customerAEmail, [
      { listingId: listingA.id, quantity: 3 },
      { listingId: listingB.id, quantity: 4 },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const detail = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    expect(detail?.items).toHaveLength(2);
    expect(detail?.total).toBe(3 * 20 + 4 * 15);
  });

  it("supports one quote spanning two customer-selected vendors", async () => {
    const listingA = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });
    const listingB = await seedListing({ vendorId: vendorBId, basePrice: 25, availableQuantity: 100 });

    const result = await generate(customerAId, customerAEmail, [
      { listingId: listingA.id, quantity: 2 },
      { listingId: listingB.id, quantity: 5 },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const detail = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    const vendorNames = detail?.items.map((item) => item.vendor?.companyName).sort();
    expect(vendorNames).toEqual(["M5 Vendor A", "M5 Vendor B"]);
  });

  // ---- Immutability ----------------------------------------------------

  it("keeps an issued quote's price unchanged after the listing's base price changes", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 100, availableQuantity: 100, vendorSupplyCost: 60 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const before = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    expect(before?.items[0]?.unitPrice).toBe(100);

    await prisma.vendorListing.update({ where: { id: listing.id }, data: { basePrice: 999 } });

    const after = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    expect(after?.items[0]?.unitPrice).toBe(100); // unchanged
    expect(after?.total).toBe(before?.total);
  });

  it("keeps an issued quote's price unchanged after bulk tiers change", async () => {
    const listing = await seedListing({
      vendorId: vendorAId,
      basePrice: 100,
      availableQuantity: 100,
      tiers: [{ minQuantity: 10, maxQuantity: null, unitPrice: 80 }],
    });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 10 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const before = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    expect(before?.items[0]?.unitPrice).toBe(80);

    await prisma.bulkPriceTier.updateMany({ where: { listingId: listing.id }, data: { unitPrice: 40 } });

    const after = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    expect(after?.items[0]?.unitPrice).toBe(80); // unchanged
  });

  // ---- Expiry ----------------------------------------------------

  it("rejects acceptance of an expired quote but keeps it viewable with its historical price", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await prisma.quotation.update({
      where: { id: result.value.quotationId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const detail = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    expect(detail?.status).toBe("EXPIRED");
    expect(detail?.total).toBe(80); // historical value still displayed

    const accept = await ordersService.createOrderFromQuotation(customerAId, result.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(false);
  });

  it("seeds a fresh draft from an expired quote's lines for reissue", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 3 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lines = await quotationService.getLinesForReissue(result.value.quotationId, customerAId);
    expect(lines).toEqual([{ listingId: listing.id, quantity: 3 }]);
  });

  // ---- Ownership ----------------------------------------------------

  it("does not let another customer view a quote they don't own", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const detail = await quotationService.getDetailForCustomer(result.value.quotationId, customerBId);
    expect(detail).toBeNull();
  });

  it("does not let another customer accept a quote they don't own", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const accept = await ordersService.createOrderFromQuotation(customerBId, result.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(false);
  });

  // ---- Acceptance ----------------------------------------------------

  it("converts an accepted quote into an Order using the quoted price, not the live listing price", async () => {
    const listing = await seedListing({
      vendorId: vendorAId,
      basePrice: 100,
      availableQuantity: 100,
      vendorSupplyCost: 60,
      tiers: [{ minQuantity: 5, maxQuantity: null, unitPrice: 80 }],
    });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 5 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Price changes after issuance — must not affect the resulting Order.
    await prisma.vendorListing.update({ where: { id: listing.id }, data: { basePrice: 999 } });
    await prisma.bulkPriceTier.updateMany({ where: { listingId: listing.id }, data: { unitPrice: 999 } });

    const accept = await ordersService.createOrderFromQuotation(customerAId, result.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;
    createdOrderIds.push(accept.value.orderId);

    const orderItem = await prisma.orderItem.findFirst({ where: { orderId: accept.value.orderId } });
    expect(orderItem?.unitPrice.toNumber()).toBe(80);
    expect(orderItem?.lineTotal.toNumber()).toBe(400);

    const quotation = await prisma.quotation.findUnique({ where: { id: result.value.quotationId } });
    expect(quotation?.status).toBe("ACCEPTED");
    expect(quotation?.acceptedAt).not.toBeNull();
  });

  it("does not create a duplicate Order on repeated acceptance calls", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const first = await ordersService.createOrderFromQuotation(customerAId, result.value.quotationId, deliveryInfo);
    expect(first.ok).toBe(true);
    if (first.ok) createdOrderIds.push(first.value.orderId);

    const second = await ordersService.createOrderFromQuotation(customerAId, result.value.quotationId, deliveryInfo);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.orderId).toBe(first.value.orderId);
    }

    const orders = await prisma.order.findMany({ where: { originQuotationId: result.value.quotationId } });
    expect(orders).toHaveLength(1);
  });

  // ---- Availability ----------------------------------------------------

  it("does not reserve or decrement inventory at quote issuance", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 50 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 30 }]);
    expect(result.ok).toBe(true);

    const after = await prisma.vendorListing.findUnique({ where: { id: listing.id } });
    expect(after?.availableQuantity).toBe(50); // unchanged
    const reservations = await prisma.inventoryReservation.findMany({ where: { listingId: listing.id } });
    expect(reservations).toHaveLength(0);
  });

  it("blocks acceptance when availability has since dropped below the quoted quantity, without changing the quoted price", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 80 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await prisma.vendorListing.update({ where: { id: listing.id }, data: { availableQuantity: 10 } });

    const accept = await ordersService.createOrderFromQuotation(customerAId, result.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(false);

    // Quote remains ISSUED (not stuck ACCEPTED) and its price is untouched.
    const quotation = await prisma.quotation.findUnique({ where: { id: result.value.quotationId } });
    expect(quotation?.status).toBe("ISSUED");
    const detail = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    expect(detail?.items[0]?.unitPrice).toBe(40);

    // Availability itself was not further mutated by the failed attempt.
    const listingAfter = await prisma.vendorListing.findUnique({ where: { id: listing.id } });
    expect(listingAfter?.availableQuantity).toBe(10);
  });

  it("blocks acceptance when the listing was deactivated after issuance", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await prisma.vendorListing.update({ where: { id: listing.id }, data: { listingStatus: "INACTIVE" } });

    const accept = await ordersService.createOrderFromQuotation(customerAId, result.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(false);

    const quotation = await prisma.quotation.findUnique({ where: { id: result.value.quotationId } });
    expect(quotation?.status).toBe("ISSUED");
  });

  // ---- Multi-vendor acceptance ----------------------------------------------------

  it("converts a multi-vendor quote into ONE Order that fans into isolated per-vendor Fulfilments on payment", async () => {
    const listingA = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });
    const listingB = await seedListing({ vendorId: vendorBId, basePrice: 25, availableQuantity: 100 });

    const result = await generate(customerAId, customerAEmail, [
      { listingId: listingA.id, quantity: 2 },
      { listingId: listingB.id, quantity: 3 },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const accept = await ordersService.createOrderFromQuotation(customerAId, result.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;
    createdOrderIds.push(accept.value.orderId);

    const orders = await prisma.order.findMany({ where: { originQuotationId: result.value.quotationId } });
    expect(orders).toHaveLength(1); // ONE customer order, not one per vendor

    await ordersService.confirmOrderPayment(accept.value.orderId);
    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId: accept.value.orderId } });
    expect(fulfilments).toHaveLength(2);
    expect(fulfilments.map((f) => f.vendorId).sort()).toEqual([vendorAId, vendorBId].sort());
  });

  // ---- Email ----------------------------------------------------

  it("dispatches a quote-issued notification and email exactly once", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });

    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Checked at the DB layer, not via a spy on the shared emailProvider
    // singleton — every test file in this suite shares one Postgres
    // instance, so a global send-call-count assertion is fragile; "exactly
    // one job was enqueued for this specific quotation, for the right
    // recipient" is not (the eventKey's uniqueness constraint is the
    // actual dedup guarantee, tested directly here).
    const notification = await prisma.notification.findFirst({ where: { eventKey: `quote-issued:${result.value.quotationId}` } });
    expect(notification).not.toBeNull();
    const jobs = await prisma.emailDeliveryJob.findMany({ where: { notificationId: notification!.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.to).toBe(customerAEmail);
  });

  it("does not fail quote issuance when email delivery fails", async () => {
    const spy = vi.spyOn(emailProviderModule.emailProvider, "send").mockRejectedValueOnce(new Error("simulated outage"));
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100 });

    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    await processEmailQueue();

    if (result.ok) {
      const quotation = await prisma.quotation.findUnique({ where: { id: result.value.quotationId } });
      expect(quotation).not.toBeNull();
    }
    spy.mockRestore();
  });

  // ---- Privacy ----------------------------------------------------

  it("never exposes vendor cost/margin fields on the customer-facing quote detail view", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100, vendorSupplyCost: 22 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const detail = await quotationService.getDetailForCustomer(result.value.quotationId, customerAId);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("vendorPayableBasis");
    expect(serialized).not.toContain("vendorSupplyCost");
    expect(serialized).not.toContain("marginValue");
  });

  it("does expose the vendor-payable snapshot on the admin quote detail view", async () => {
    const listing = await seedListing({ vendorId: vendorAId, basePrice: 40, availableQuantity: 100, vendorSupplyCost: 22 });
    const result = await generate(customerAId, customerAEmail, [{ listingId: listing.id, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const adminDetail = await quotationService.getDetailForAdmin(result.value.quotationId);
    expect(adminDetail?.items[0]?.vendorPayableBasis).toBe(44); // 22 x 2
  });
});
