import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { sourcingService } from "./service";
import { quotationService } from "../quotation/service";
import { ordersService } from "../orders/service";
import { messagingService } from "../messaging/service";
import { validateAttachment } from "../../lib/attachment-validation";
import * as emailProviderModule from "../../lib/email-provider";
import { processEmailQueue } from "../../lib/email-worker";
import type { DeliveryInfo } from "../orders/types";
import type { SourcingRequestInput } from "./types";

const deliveryInfo: DeliveryInfo = {
  recipientName: "Ama Customer",
  phone: "0244111222",
  addressLine1: "5 Customer Close",
  city: "Accra",
  region: "Greater Accra",
};

const baseInput: SourcingRequestInput = {
  title: "500 custom embroidered polo shirts",
  description: "Navy blue, 220gsm cotton, left-chest embroidered logo.",
  quantity: 500,
  quantityUnit: "pieces",
  deliveryCountry: "Ghana",
  deliveryCity: "Accra",
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Integration tests against the real local Postgres dev database. */
describe("sourcingService", () => {
  let categoryId: string;
  let vendorId: string;
  let listingId: string;
  let customerAId: string;
  let customerAUserId: string;
  let customerAEmail: string;
  let customerBId: string;
  let staffUserId: string;
  let staffAdminId: string;

  const createdVendorIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdRequestIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdAdminIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendor = await prisma.vendor.create({
      data: { companyName: "M6 Vendor", storefrontSlug: `m6-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    vendorId = vendor.id;
    createdVendorIds.push(vendor.id);

    const category = await prisma.category.create({ data: { name: "M6 Test Category", slug: `m6-test-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "M6 Listing",
        description: "Fixture.",
        basePrice: 10,
        moq: 1,
        availableQuantity: 1000,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });
    listingId = listing.id;
    createdListingIds.push(listing.id);

    const userA = await prisma.user.create({
      data: { id: `m6-customer-a-${suffix}`, name: "Customer A", email: `m6.customer.a.${suffix}@example.com` },
    });
    createdUserIds.push(userA.id);
    customerAUserId = userA.id;
    customerAEmail = userA.email;
    const customerA = await prisma.customerProfile.create({ data: { userId: userA.id, displayName: "Customer A" } });
    customerAId = customerA.id;
    createdCustomerIds.push(customerA.id);

    const userB = await prisma.user.create({
      data: { id: `m6-customer-b-${suffix}`, name: "Customer B", email: `m6.customer.b.${suffix}@example.com` },
    });
    createdUserIds.push(userB.id);
    const customerB = await prisma.customerProfile.create({ data: { userId: userB.id, displayName: "Customer B" } });
    customerBId = customerB.id;
    createdCustomerIds.push(customerB.id);

    const staffUser = await prisma.user.create({
      data: { id: `m6-staff-${suffix}`, name: "Ops Staff", email: `m6.staff.${suffix}@example.com` },
    });
    createdUserIds.push(staffUser.id);
    staffUserId = staffUser.id;
    const staffAdmin = await prisma.adminUser.create({ data: { userId: staffUserId, role: "OPS_ADMIN" } });
    staffAdminId = staffAdmin.id;
    createdAdminIds.push(staffAdmin.id);
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversation: { contextSourcingRequestId: { in: createdRequestIds } } } });
    await prisma.conversation.deleteMany({ where: { contextSourcingRequestId: { in: createdRequestIds } } });
    await prisma.vendorFinancialAdjustment.deleteMany({ where: { vendorEarning: { orderId: { in: createdOrderIds } } } });
    await prisma.vendorEarning.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.quotationItem.deleteMany({ where: { quotation: { sourcingRequestId: { in: createdRequestIds } } } });
    await prisma.quotation.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.sourcingRequestActivity.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.sourcingAllocation.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.sourcingOption.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.sourcingRequestAttachment.deleteMany({ where: { sourcingRequestId: { in: createdRequestIds } } });
    await prisma.customSourcingRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: createdAdminIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function submit(customerProfileId: string, email: string, overrides: Partial<SourcingRequestInput> = {}) {
    const result = await sourcingService.submitRequest(customerProfileId, customerAUserId, email, { ...baseInput, ...overrides }, []);
    if (result.ok) createdRequestIds.push(result.value.id);
    return result;
  }

  // ---- Request creation ----------------------------------------------------

  it("submits a valid request with a generated reference and owns it", async () => {
    const result = await submit(customerAId, customerAEmail);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.requestNumber).toMatch(/^SR-\d{8}-[A-Z0-9]{5}$/);

    const detail = await sourcingService.getDetailForCustomer(result.value.id, customerAId);
    expect(detail?.status).toBe("SUBMITTED");
    expect(detail?.statusLabel).toBe("Request received");
  });

  it("derives a title from the description when none is provided (M24 photo-first)", async () => {
    const result = await submit(customerAId, customerAEmail, { title: undefined, description: "500 branded gift bags for a corporate event" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = await sourcingService.getDetailForCustomer(result.value.id, customerAId);
    expect(detail?.title).toBe("500 branded gift bags for a corporate event");
  });

  it("rejects a request with neither a description nor an attachment", async () => {
    const result = await submit(customerAId, customerAEmail, { title: undefined, description: "" });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid quantity", async () => {
    const result = await submit(customerAId, customerAEmail, { quantity: 0 });
    expect(result.ok).toBe(false);
  });

  it("accepts an optional budget and required-by date", async () => {
    const result = await submit(customerAId, customerAEmail, {
      budgetAmount: 40000,
      budgetCurrency: "GHS",
      requiredByDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = await sourcingService.getDetailForCustomer(result.value.id, customerAId);
    expect(detail?.budgetAmount).toBe(40000);
    expect(detail?.requiredByDate).not.toBeNull();
  });

  it("supports a request with no category (arbitrary unlisted requirement)", async () => {
    const result = await submit(customerAId, customerAEmail);
    expect(result.ok).toBe(true);
  });

  // ---- State machine ----------------------------------------------------

  it("walks the full valid transition sequence to QUOTED", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    const id = created.value.id;

    expect((await sourcingService.moveToUnderReview(id)).ok).toBe(true);
    expect((await sourcingService.moveToSourcing(id)).ok).toBe(true);
    expect((await sourcingService.requestClarification(id, staffUserId, "Please confirm logo placement.")).ok).toBe(true);

    let detail = await sourcingService.getDetailForAdmin(id);
    expect(detail?.status).toBe("AWAITING_CUSTOMER");

    expect((await sourcingService.moveToSourcing(id)).ok).toBe(true); // resume

    const optionResult = await sourcingService.addOption(id, {
      sourceType: "VENDOR_LISTING",
      vendorId,
      vendorListingId: listingId,
      proposedQuantity: 500,
      unitSupplyCost: 30,
    });
    expect(optionResult.ok).toBe(true);

    detail = await sourcingService.getDetailForAdmin(id);
    const optionId = detail!.options[0]!.id;

    expect((await sourcingService.setAllocations(id, [{ sourcingOptionId: optionId, allocatedQuantity: 500 }])).ok).toBe(true);

    const quoteResult = await sourcingService.prepareAndIssueQuote(id, { description: "500 polo shirts", unitPrice: 57 });
    expect(quoteResult.ok).toBe(true);

    detail = await sourcingService.getDetailForAdmin(id);
    expect(detail?.status).toBe("QUOTED");
  });

  it("rejects issuing a quote before a request has reached SOURCING", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    const result = await sourcingService.prepareAndIssueQuote(created.value.id, { description: "x", unitPrice: 10 });
    expect(result.ok).toBe(false);
  });

  it("rejects moving straight to SOURCING from SUBMITTED (must pass through UNDER_REVIEW)", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    const result = await sourcingService.moveToSourcing(created.value.id);
    expect(result.ok).toBe(false);
  });

  // ---- Sourcing options / privacy ----------------------------------------------------

  it("adds VENDOR_LISTING, VENDOR, and EXTERNAL_SUPPLIER options", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    const id = created.value.id;
    await sourcingService.moveToUnderReview(id);
    await sourcingService.moveToSourcing(id);

    expect((await sourcingService.addOption(id, { sourceType: "VENDOR_LISTING", vendorId, vendorListingId: listingId, proposedQuantity: 200, unitSupplyCost: 30 })).ok).toBe(true);
    expect((await sourcingService.addOption(id, { sourceType: "VENDOR", vendorId, proposedQuantity: 100, unitSupplyCost: 32 })).ok).toBe(true);
    expect((await sourcingService.addOption(id, { sourceType: "EXTERNAL_SUPPLIER", externalSupplierName: "Guangzhou Textiles Co.", externalSupplierContact: "+86 123", proposedQuantity: 200, unitSupplyCost: 25 })).ok).toBe(true);

    const detail = await sourcingService.getDetailForAdmin(id);
    expect(detail?.options).toHaveLength(3);
  });

  it("never exposes sourcing options/internal notes/costs on the customer-facing detail view", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    const id = created.value.id;
    await sourcingService.moveToUnderReview(id);
    await sourcingService.moveToSourcing(id);
    await sourcingService.addOption(id, {
      sourceType: "EXTERNAL_SUPPLIER",
      externalSupplierName: "Secret Supplier Ltd",
      externalSupplierContact: "secret@supplier.com",
      proposedQuantity: 500,
      unitSupplyCost: 25,
      notes: "Confidential negotiation notes",
    });

    const detail = await sourcingService.getDetailForCustomer(id, customerAId);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("Secret Supplier");
    expect(serialized).not.toContain("secret@supplier.com");
    expect(serialized).not.toContain("Confidential negotiation");
    expect(serialized).not.toContain("unitSupplyCost");
    expect(detail).not.toHaveProperty("options");
    expect(detail).not.toHaveProperty("allocations");
  });

  // ---- Allocation ----------------------------------------------------

  it("blocks quote issuance when allocated quantity does not match the requested quantity", async () => {
    const created = await submit(customerAId, customerAEmail, { quantity: 100 });
    if (!created.ok) return;
    const id = created.value.id;
    await sourcingService.moveToUnderReview(id);
    await sourcingService.moveToSourcing(id);
    await sourcingService.addOption(id, { sourceType: "VENDOR_LISTING", vendorId, vendorListingId: listingId, proposedQuantity: 100, unitSupplyCost: 30 });

    const detail = await sourcingService.getDetailForAdmin(id);
    const optionId = detail!.options[0]!.id;
    await sourcingService.setAllocations(id, [{ sourcingOptionId: optionId, allocatedQuantity: 80 }]); // short of 100

    const quoteResult = await sourcingService.prepareAndIssueQuote(id, { description: "x", unitPrice: 10 });
    expect(quoteResult.ok).toBe(false);

    const quotations = await prisma.quotation.findMany({ where: { sourcingRequestId: id } });
    expect(quotations).toHaveLength(0);
  });

  it("snapshots allocation cost at allocation time — a later option cost change doesn't retroactively alter it", async () => {
    const created = await submit(customerAId, customerAEmail, { quantity: 100 });
    if (!created.ok) return;
    const id = created.value.id;
    await sourcingService.moveToUnderReview(id);
    await sourcingService.moveToSourcing(id);
    await sourcingService.addOption(id, { sourceType: "VENDOR_LISTING", vendorId, vendorListingId: listingId, proposedQuantity: 100, unitSupplyCost: 30 });

    let detail = await sourcingService.getDetailForAdmin(id);
    const optionId = detail!.options[0]!.id;
    await sourcingService.setAllocations(id, [{ sourcingOptionId: optionId, allocatedQuantity: 100 }]);

    await prisma.sourcingOption.update({ where: { id: optionId }, data: { unitSupplyCost: 999 } });

    detail = await sourcingService.getDetailForAdmin(id);
    expect(detail?.allocations[0]?.unitSupplyCostSnapshot).toBe(30); // unchanged
  });

  // ---- Custom quotation ----------------------------------------------------

  async function sourceAndQuote(options: { quantity?: number; splitVendorTwo?: boolean; external?: boolean } = {}) {
    const quantity = options.quantity ?? 100;
    const created = await submit(customerAId, customerAEmail, { quantity });
    if (!created.ok) throw new Error("submit failed");
    const id = created.value.id;
    await sourcingService.moveToUnderReview(id);
    await sourcingService.moveToSourcing(id);

    if (options.external) {
      await sourcingService.addOption(id, { sourceType: "EXTERNAL_SUPPLIER", externalSupplierName: "Ext Co", proposedQuantity: quantity, unitSupplyCost: 20 });
      const detail = await sourcingService.getDetailForAdmin(id);
      await sourcingService.setAllocations(id, [{ sourcingOptionId: detail!.options[0]!.id, allocatedQuantity: quantity }]);
    } else if (options.splitVendorTwo) {
      const vendorTwo = await prisma.vendor.create({ data: { companyName: "M6 Vendor Two", storefrontSlug: `m6-vendor-two-${Date.now()}`, verificationStatus: "APPROVED", country: "Ghana" } });
      createdVendorIds.push(vendorTwo.id);
      await sourcingService.addOption(id, { sourceType: "VENDOR", vendorId, proposedQuantity: quantity / 2, unitSupplyCost: 30 });
      await sourcingService.addOption(id, { sourceType: "VENDOR", vendorId: vendorTwo.id, proposedQuantity: quantity / 2, unitSupplyCost: 32 });
      const detail = await sourcingService.getDetailForAdmin(id);
      await sourcingService.setAllocations(id, detail!.options.map((o) => ({ sourcingOptionId: o.id, allocatedQuantity: quantity / 2 })));
    } else {
      await sourcingService.addOption(id, { sourceType: "VENDOR_LISTING", vendorId, vendorListingId: listingId, proposedQuantity: quantity, unitSupplyCost: 30 });
      const detail = await sourcingService.getDetailForAdmin(id);
      await sourcingService.setAllocations(id, [{ sourcingOptionId: detail!.options[0]!.id, allocatedQuantity: quantity }]);
    }

    const quote = await sourcingService.prepareAndIssueQuote(id, { description: "500 polo shirts, navy, embroidered", unitPrice: 57 });
    return { id, quote };
  }

  it("issues a custom quote referencing the sourcing request, with no VendorListing-backed item", async () => {
    const { id, quote } = await sourceAndQuote();
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const quotationRow = await prisma.quotation.findUnique({ where: { id: quote.value.quotationId }, include: { items: true } });
    expect(quotationRow?.sourcingRequestId).toBe(id);
    expect(quotationRow?.origin).toBe("CUSTOM_SOURCING");
    expect(quotationRow?.items[0]?.listingId).toBeNull();
  });

  it("computes the correct customer commercial price and transitions the request to QUOTED", async () => {
    const { id, quote } = await sourceAndQuote({ quantity: 100 });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const customerQuote = await quotationService.getDetailForCustomer(quote.value.quotationId, customerAId);
    expect(customerQuote?.total).toBe(5700); // 100 x 57
    expect(customerQuote?.items[0]?.vendor).toBeNull(); // never attributed to the customer

    const request = await sourcingService.getDetailForAdmin(id);
    expect(request?.status).toBe("QUOTED");
  });

  it("never exposes internal supplier cost on the customer-facing quote view", async () => {
    const { quote } = await sourceAndQuote();
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    const customerQuote = await quotationService.getDetailForCustomer(quote.value.quotationId, customerAId);
    const serialized = JSON.stringify(customerQuote);
    expect(serialized).not.toContain("vendorPayableBasis");
  });

  it("dispatches a quote-ready notification and email exactly once, and doesn't fail issuance when delivery fails", async () => {
    const { quote } = await sourceAndQuote();
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    // Checked at the DB layer, not via a spy on the shared emailProvider
    // singleton — every test file in this suite shares one Postgres
    // instance, so a global send-call-count assertion is fragile; "exactly
    // one job was enqueued for this specific quotation" is not (the
    // eventKey's uniqueness constraint is the actual dedup guarantee).
    const notification = await prisma.notification.findFirst({ where: { eventKey: `sourcing-quote-ready:${quote.value.quotationId}` } });
    expect(notification).not.toBeNull();
    const jobs = await prisma.emailDeliveryJob.findMany({ where: { notificationId: notification!.id } });
    expect(jobs).toHaveLength(1);

    const spyFail = vi.spyOn(emailProviderModule.emailProvider, "send").mockRejectedValueOnce(new Error("outage"));
    const { quote: quote2 } = await sourceAndQuote();
    await processEmailQueue();
    expect(quote2.ok).toBe(true); // issuance itself unaffected
    spyFail.mockRestore();
  });

  // ---- Quote immutability / supersede ----------------------------------------------------

  it("keeps an issued custom quote's price unchanged after the sourcing option's cost changes", async () => {
    const { id, quote } = await sourceAndQuote({ quantity: 100 });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const before = await quotationService.getDetailForCustomer(quote.value.quotationId, customerAId);
    expect(before?.total).toBe(5700);

    const detail = await sourcingService.getDetailForAdmin(id);
    await prisma.sourcingOption.update({ where: { id: detail!.options[0]!.id }, data: { unitSupplyCost: 999 } });

    const after = await quotationService.getDetailForCustomer(quote.value.quotationId, customerAId);
    expect(after?.total).toBe(5700); // unchanged
  });

  it("supersedes the old quote when a request is reissued, preserving both", async () => {
    const { id, quote } = await sourceAndQuote({ quantity: 100 });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const second = await sourcingService.prepareAndIssueQuote(id, { description: "Revised: 100 polo shirts", unitPrice: 60 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const oldQuote = await prisma.quotation.findUnique({ where: { id: quote.value.quotationId } });
    const newQuote = await prisma.quotation.findUnique({ where: { id: second.value.quotationId } });
    expect(oldQuote?.status).toBe("SUPERSEDED");
    expect(newQuote?.status).toBe("ISSUED");
    expect(newQuote?.supersedesQuotationId).toBe(oldQuote?.id);
  });

  // ---- Acceptance / Order / Fulfilment ----------------------------------------------------

  it("converts an accepted single-vendor-sourced custom quote into an Order with an automatic Fulfilment", async () => {
    const { id, quote } = await sourceAndQuote({ quantity: 50 });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const accept = await ordersService.createOrderFromQuotation(customerAId, quote.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;
    createdOrderIds.push(accept.value.orderId);

    const request = await sourcingService.getDetailForAdmin(id);
    expect(request?.status).toBe("ACCEPTED");

    await ordersService.confirmOrderPayment(accept.value.orderId);
    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId: accept.value.orderId } });
    expect(fulfilments).toHaveLength(1);
    expect(fulfilments[0]?.vendorId).toBe(vendorId);
  });

  it("does not auto-create a Fulfilment for a mixed multi-vendor-sourced custom order", async () => {
    const { quote } = await sourceAndQuote({ quantity: 100, splitVendorTwo: true });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const accept = await ordersService.createOrderFromQuotation(customerAId, quote.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;
    createdOrderIds.push(accept.value.orderId);

    const orderItem = await prisma.orderItem.findFirst({ where: { orderId: accept.value.orderId } });
    expect(orderItem?.vendorId).toBeNull();

    await ordersService.confirmOrderPayment(accept.value.orderId);
    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId: accept.value.orderId } });
    expect(fulfilments).toHaveLength(0); // operations manages this leg manually via the allocation view
  });

  it("does not auto-create a Fulfilment for an externally-sourced custom order", async () => {
    const { quote } = await sourceAndQuote({ quantity: 50, external: true });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const accept = await ordersService.createOrderFromQuotation(customerAId, quote.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;
    createdOrderIds.push(accept.value.orderId);

    await ordersService.confirmOrderPayment(accept.value.orderId);
    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId: accept.value.orderId } });
    expect(fulfilments).toHaveLength(0);
  });

  it("does not create a duplicate Order on repeated acceptance of a custom quote", async () => {
    const { quote } = await sourceAndQuote({ quantity: 50 });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const first = await ordersService.createOrderFromQuotation(customerAId, quote.value.quotationId, deliveryInfo);
    expect(first.ok).toBe(true);
    if (first.ok) createdOrderIds.push(first.value.orderId);
    const second = await ordersService.createOrderFromQuotation(customerAId, quote.value.quotationId, deliveryInfo);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.value.orderId).toBe(first.value.orderId);

    const orders = await prisma.order.findMany({ where: { originQuotationId: quote.value.quotationId } });
    expect(orders).toHaveLength(1);
  });

  it("never exposes supplier allocation costs on the customer Order detail view", async () => {
    const { quote } = await sourceAndQuote({ quantity: 50 });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    const accept = await ordersService.createOrderFromQuotation(customerAId, quote.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(true);
    if (!accept.ok) return;
    createdOrderIds.push(accept.value.orderId);

    const detail = await ordersService.getOrderDetail(accept.value.orderId, customerAId);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("vendorPayableBasis");
    expect(serialized).not.toContain("unitSupplyCost");
  });

  // ---- Ownership / IDOR ----------------------------------------------------

  it("does not let another customer view a sourcing request they don't own", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    const detail = await sourcingService.getDetailForCustomer(created.value.id, customerBId);
    expect(detail).toBeNull();
  });

  it("does not let another customer accept a custom quote they don't own", async () => {
    const { quote } = await sourceAndQuote({ quantity: 50 });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    const accept = await ordersService.createOrderFromQuotation(customerBId, quote.value.quotationId, deliveryInfo);
    expect(accept.ok).toBe(false);
  });

  // ---- Cancellation ----------------------------------------------------

  it("lets the customer cancel a request before it's quoted, but not after", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    const cancel = await sourcingService.cancelRequest(created.value.id, customerAId);
    expect(cancel.ok).toBe(true);
    const detail = await sourcingService.getDetailForCustomer(created.value.id, customerAId);
    expect(detail?.status).toBe("CANCELLED");

    const { id: quotedId, quote } = await sourceAndQuote({ quantity: 20 });
    expect(quote.ok).toBe(true);
    const cancelQuoted = await sourcingService.cancelRequest(quotedId, customerAId);
    expect(cancelQuoted.ok).toBe(false);
  });

  // ---- Unable to source ----------------------------------------------------

  it("marks a request unable to source with a customer-safe reason and notifies the customer", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    await sourcingService.moveToUnderReview(created.value.id);

    const result = await sourcingService.markUnableToSource(created.value.id, "We couldn't find a supplier meeting the timeline.");
    expect(result.ok).toBe(true);

    // Checked at the DB layer — see the sibling quote-ready test's comment.
    const notification = await prisma.notification.findFirst({ where: { eventKey: `sourcing-unable-to-source:${created.value.id}` } });
    expect(notification).not.toBeNull();
    const jobs = await prisma.emailDeliveryJob.findMany({ where: { notificationId: notification!.id } });
    expect(jobs).toHaveLength(1);

    const detail = await sourcingService.getDetailForCustomer(created.value.id, customerAId);
    expect(detail?.status).toBe("UNABLE_TO_SOURCE");
    expect(detail?.unableToSourceReason).toContain("couldn't find a supplier");
  });

  // ---- Messaging ----------------------------------------------------

  it("creates a contextual sourcing conversation and lets staff continue it without duplicating", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    const id = created.value.id;

    const customerMsg = await messagingService.startOrContinueContextual({
      customerProfileId: customerAId,
      senderUserId: customerAUserId,
      contextType: "SOURCING_REQUEST",
      contextRefId: id,
      body: "Can the logo be embroidered?",
    });
    expect(customerMsg.ok).toBe(true);

    await sourcingService.moveToUnderReview(id);
    await sourcingService.moveToSourcing(id);
    const clarification = await sourcingService.requestClarification(id, staffUserId, "Yes — left chest or centered?");
    expect(clarification.ok).toBe(true);

    if (customerMsg.ok && clarification.ok) {
      const conversations = await prisma.conversation.findMany({ where: { contextSourcingRequestId: id } });
      expect(conversations).toHaveLength(1); // no duplicate thread
    }
  });

  it("creates a staff-initiated conversation when none exists yet, and rejects a forged sourcing-request context", async () => {
    const created = await submit(customerAId, customerAEmail);
    if (!created.ok) return;
    const id = created.value.id;
    await sourcingService.moveToUnderReview(id);
    await sourcingService.moveToSourcing(id);

    const result = await sourcingService.requestClarification(id, staffUserId, "We need the artwork file.");
    expect(result.ok).toBe(true);

    const forged = await messagingService.startOrContinueContextual({
      customerProfileId: customerBId,
      senderUserId: customerAUserId,
      contextType: "SOURCING_REQUEST",
      contextRefId: id, // belongs to customer A, not B
      body: "trying to attach to someone else's request",
    });
    expect(forged.ok).toBe(false);
  });

  // ---- Attachments ----------------------------------------------------

  it("accepts a valid PNG and rejects a disallowed type / oversized file", () => {
    expect(validateAttachment({ mimeType: "image/png", sizeBytes: PNG_MAGIC.length, buffer: PNG_MAGIC }).ok).toBe(true);
    expect(validateAttachment({ mimeType: "application/x-msdownload", sizeBytes: 10, buffer: Buffer.from("x") }).ok).toBe(false);
    expect(validateAttachment({ mimeType: "image/png", sizeBytes: 11 * 1024 * 1024, buffer: PNG_MAGIC }).ok).toBe(false);
  });

  it("rejects a file whose content doesn't match its claimed MIME type", () => {
    const fakePng = Buffer.from("not actually a png");
    expect(validateAttachment({ mimeType: "image/png", sizeBytes: fakePng.length, buffer: fakePng }).ok).toBe(false);
  });

  it("scopes attachment download access to the owning customer or staff only", async () => {
    const created = await sourcingService.submitRequest(customerAId, customerAUserId, customerAEmail, baseInput, [
      { buffer: PNG_MAGIC, filename: "logo.png", mimeType: "image/png" },
    ]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdRequestIds.push(created.value.id);

    const detail = await sourcingService.getDetailForCustomer(created.value.id, customerAId);
    const attachmentId = detail!.attachments[0]!.id;

    const ownerAccess = await sourcingService.getAttachmentForDownload(attachmentId, { customerProfileId: customerAId, isStaff: false });
    expect(ownerAccess).not.toBeNull();

    const otherCustomerAccess = await sourcingService.getAttachmentForDownload(attachmentId, { customerProfileId: customerBId, isStaff: false });
    expect(otherCustomerAccess).toBeNull();

    const staffAccess = await sourcingService.getAttachmentForDownload(attachmentId, { isStaff: true });
    expect(staffAccess).not.toBeNull();
  });

  it("rejects more than the maximum allowed attachments", async () => {
    const files = Array.from({ length: 6 }, (_, i) => ({ buffer: PNG_MAGIC, filename: `f${i}.png`, mimeType: "image/png" }));
    const result = await sourcingService.submitRequest(customerAId, customerAUserId, customerAEmail, baseInput, files);
    expect(result.ok).toBe(false);
  });

  it("accepts a photo-only request with no title or description (M24 photo-first)", async () => {
    const result = await sourcingService.submitRequest(
      customerAId,
      customerAUserId,
      customerAEmail,
      { ...baseInput, title: undefined, description: "" },
      [{ buffer: PNG_MAGIC, filename: "item.png", mimeType: "image/png" }],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdRequestIds.push(result.value.id);
    const detail = await sourcingService.getDetailForCustomer(result.value.id, customerAId);
    expect(detail?.title).toBe("Photo sourcing request");
    expect(detail?.attachments).toHaveLength(1);
  });

  it("surfaces the first attachment as primaryAttachment on the customer summary list (M24)", async () => {
    const created = await sourcingService.submitRequest(customerAId, customerAUserId, customerAEmail, baseInput, [
      { buffer: PNG_MAGIC, filename: "item.png", mimeType: "image/png" },
    ]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdRequestIds.push(created.value.id);

    const { rows } = await sourcingService.listForCustomer(customerAId);
    const summary = rows.find((r) => r.id === created.value.id);
    expect(summary?.primaryAttachment).toEqual({ id: expect.any(String), mimeType: "image/png" });
  });

  // ---- Factory solicitation (M25.2) ----------------------------------------

  describe("factory solicitation", () => {
    let vendorTwoId: string;

    beforeEach(async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const vendorTwo = await prisma.vendor.create({
        data: { companyName: "M25.2 Factory Two", storefrontSlug: `m252-factory-two-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
      });
      vendorTwoId = vendorTwo.id;
      createdVendorIds.push(vendorTwo.id);

      const ownerOne = await prisma.user.create({
        data: { id: `m252-owner-one-${suffix}`, name: "Factory One Owner", email: `m252.owner.one.${suffix}@example.com` },
      });
      createdUserIds.push(ownerOne.id);
      await prisma.vendorMembership.create({ data: { userId: ownerOne.id, vendorId, role: "OWNER" } });

      const ownerTwo = await prisma.user.create({
        data: { id: `m252-owner-two-${suffix}`, name: "Factory Two Owner", email: `m252.owner.two.${suffix}@example.com` },
      });
      createdUserIds.push(ownerTwo.id);
      await prisma.vendorMembership.create({ data: { userId: ownerTwo.id, vendorId: vendorTwoId, role: "OWNER" } });
    });

    async function submitAndSendToFactories(vendorIds: string[], overrides: Partial<SourcingRequestInput> = {}) {
      const created = await submit(customerAId, customerAEmail, overrides);
      if (!created.ok) throw new Error("submit failed");
      const id = created.value.id;
      await sourcingService.moveToUnderReview(id);
      await sourcingService.moveToSourcing(id);
      const sent = await sourcingService.sendToFactories(id, vendorIds, staffUserId);
      return { id, sent };
    }

    it("sends the same request to selected factories and each factory can read only its own solicitation", async () => {
      const { id, sent } = await submitAndSendToFactories([vendorId, vendorTwoId]);
      expect(sent.ok).toBe(true);

      const { rows: factoryOneQueue } = await sourcingService.listSolicitationsForVendor(vendorId);
      const { rows: factoryTwoQueue } = await sourcingService.listSolicitationsForVendor(vendorTwoId);
      expect(factoryOneQueue.some((r) => r.requestReference && factoryOneQueue.length > 0)).toBe(true);
      const solicitationOne = factoryOneQueue[0]!;
      const solicitationTwo = factoryTwoQueue[0]!;
      expect(solicitationOne.id).not.toBe(solicitationTwo.id);

      const detailForOwner = await sourcingService.getSolicitationDetailForVendor(solicitationOne.id, vendorId);
      expect(detailForOwner).not.toBeNull();
      expect(detailForOwner?.quantity).toBe(baseInput.quantity);

      // IDOR: factory two cannot read factory one's solicitation.
      const crossAccess = await sourcingService.getSolicitationDetailForVendor(solicitationOne.id, vendorTwoId);
      expect(crossAccess).toBeNull();

      const detail = await sourcingService.getDetailForAdmin(id);
      expect(detail?.solicitations).toHaveLength(2);
    });

    it("never exposes customer name/email/private data on the factory-facing detail view", async () => {
      const { id } = await submitAndSendToFactories([vendorId]);
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      const solicitation = rows.find((r) => r.requestReference)!;
      const detail = await sourcingService.getSolicitationDetailForVendor(solicitation.id, vendorId);
      const serialized = JSON.stringify(detail);
      expect(serialized).not.toContain(customerAEmail);
      expect(serialized).not.toContain("Customer A");
      expect(detail).not.toHaveProperty("customerName");
      expect(detail).not.toHaveProperty("customerEmail");
      void id;
    });

    it("is idempotent — re-sending to an already-asked factory does not duplicate the solicitation", async () => {
      const { id } = await submitAndSendToFactories([vendorId]);
      const again = await sourcingService.sendToFactories(id, [vendorId], staffUserId);
      expect(again.ok).toBe(true);

      const detail = await sourcingService.getDetailForAdmin(id);
      expect(detail?.solicitations).toHaveLength(1);
    });

    it("records a CAN FULFIL response with the factory's own figures and moves it to RESPONDED", async () => {
      const { id } = await submitAndSendToFactories([vendorId]);
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      const solicitationId = rows[0]!.id;

      const responded = await sourcingService.respondToSolicitation(solicitationId, vendorId, {
        canFulfil: true,
        proposedQuantity: 10000,
        unitPrice: 32,
        leadTimeDays: 14,
        notes: "Can start immediately.",
      });
      expect(responded.ok).toBe(true);

      const detail = await sourcingService.getDetailForAdmin(id);
      const solicitation = detail!.solicitations.find((s) => s.id === solicitationId)!;
      expect(solicitation.status).toBe("RESPONDED");
      expect(solicitation.proposedQuantity).toBe(10000);
      expect(solicitation.unitPrice).toBe(32);
      expect(solicitation.leadTimeDays).toBe(14);
    });

    it("records a CANNOT FULFIL response distinctly from a can-fulfil response", async () => {
      const { id } = await submitAndSendToFactories([vendorId]);
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      const solicitationId = rows[0]!.id;

      const responded = await sourcingService.respondToSolicitation(solicitationId, vendorId, { canFulfil: false });
      expect(responded.ok).toBe(true);

      const detail = await sourcingService.getDetailForAdmin(id);
      const solicitation = detail!.solicitations.find((s) => s.id === solicitationId)!;
      expect(solicitation.status).toBe("CANNOT_FULFIL");
      expect(solicitation.proposedQuantity).toBeNull();
      expect(solicitation.unitPrice).toBeNull();
    });

    it("rejects a second response to an already-answered solicitation", async () => {
      const { id } = await submitAndSendToFactories([vendorId]);
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      const solicitationId = rows[0]!.id;

      await sourcingService.respondToSolicitation(solicitationId, vendorId, { canFulfil: false });
      const secondAttempt = await sourcingService.respondToSolicitation(solicitationId, vendorId, {
        canFulfil: true,
        proposedQuantity: 100,
        unitPrice: 10,
      });
      expect(secondAttempt.ok).toBe(false);
      void id;
    });

    it("rejects a factory responding to another factory's solicitation (IDOR)", async () => {
      const { id } = await submitAndSendToFactories([vendorId]);
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      const solicitationId = rows[0]!.id;

      const forged = await sourcingService.respondToSolicitation(solicitationId, vendorTwoId, {
        canFulfil: true,
        proposedQuantity: 100,
        unitPrice: 10,
      });
      expect(forged.ok).toBe(false);

      const detail = await sourcingService.getDetailForAdmin(id);
      expect(detail?.solicitations.find((s) => s.id === solicitationId)?.status).toBe("SENT");
    });

    it("converts a RESPONDED solicitation into a SourcingOption automatically, and that option flows through allocation and quote issuance", async () => {
      const { id } = await submitAndSendToFactories([vendorId], { quantity: 10000 });
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      const solicitationId = rows[0]!.id;

      await sourcingService.respondToSolicitation(solicitationId, vendorId, {
        canFulfil: true,
        proposedQuantity: 10000,
        unitPrice: 32,
        leadTimeDays: 14,
        notes: "Factory notes.",
      });

      const conversion = await sourcingService.useSolicitationForOption(id, solicitationId);
      expect(conversion.ok).toBe(true);
      if (!conversion.ok) return;

      const detail = await sourcingService.getDetailForAdmin(id);
      const option = detail!.options.find((o) => o.id === conversion.value.optionId)!;
      expect(option.sourceType).toBe("VENDOR");
      expect(option.vendorId).toBe(vendorId);
      expect(option.proposedQuantity).toBe(10000);
      expect(option.unitSupplyCost).toBe(32);
      expect(option.leadTimeDays).toBe(14);

      await sourcingService.setAllocations(id, [{ sourcingOptionId: option.id, allocatedQuantity: 10000 }]);
      const suggestion = await sourcingService.getQuotePricingSuggestion(option.id);
      expect(suggestion?.customerUnitPrice).toBe(36.8); // 32 * 1.15

      const quote = await sourcingService.prepareAndIssueQuote(id, {
        description: "10,000 units",
        unitPrice: suggestion!.customerUnitPrice,
      });
      expect(quote.ok).toBe(true);
      if (!quote.ok) return;
      const customerQuote = await quotationService.getDetailForCustomer(quote.value.quotationId, customerAId);
      expect(customerQuote?.total).toBe(368000); // 10,000 * 36.80
      // Never leaks factory identity/cost/markup to the customer quote.
      const serialized = JSON.stringify(customerQuote);
      expect(serialized).not.toContain("32");
      expect(customerQuote?.items[0]?.vendor).toBeNull();
    });

    it("is idempotent under a repeat click — using the same response twice returns the same option, never a duplicate", async () => {
      const { id } = await submitAndSendToFactories([vendorId]);
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      const solicitationId = rows[0]!.id;
      await sourcingService.respondToSolicitation(solicitationId, vendorId, { canFulfil: true, proposedQuantity: 100, unitPrice: 10 });

      const first = await sourcingService.useSolicitationForOption(id, solicitationId);
      const second = await sourcingService.useSolicitationForOption(id, solicitationId);
      expect(first.ok && second.ok && first.value.optionId === second.value.optionId).toBe(true);

      const detail = await sourcingService.getDetailForAdmin(id);
      expect(detail?.options).toHaveLength(1);
    });

    it("rejects converting a solicitation that hasn't responded yet, or cannot fulfil", async () => {
      const { id } = await submitAndSendToFactories([vendorId]);
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      const solicitationId = rows[0]!.id;

      const beforeResponse = await sourcingService.useSolicitationForOption(id, solicitationId);
      expect(beforeResponse.ok).toBe(false);

      await sourcingService.respondToSolicitation(solicitationId, vendorId, { canFulfil: false });
      const afterDecline = await sourcingService.useSolicitationForOption(id, solicitationId);
      expect(afterDecline.ok).toBe(false);
    });

    it("computes the customer markup price with 2dp Decimal rounding, not floating-point drift", async () => {
      const { id } = await submitAndSendToFactories([vendorId], { quantity: 3 });
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      const solicitationId = rows[0]!.id;
      await sourcingService.respondToSolicitation(solicitationId, vendorId, { canFulfil: true, proposedQuantity: 3, unitPrice: 32.33 });
      const conversion = await sourcingService.useSolicitationForOption(id, solicitationId);
      if (!conversion.ok) throw new Error("conversion failed");

      const suggestion = await sourcingService.getQuotePricingSuggestion(conversion.value.optionId, 15);
      // 32.33 * 1.15 = 37.1795 -> rounds to 37.18 (2dp, never a raw float like 37.17949999999999)
      expect(suggestion?.customerUnitPrice).toBe(37.18);
      expect(suggestion?.factorySubtotal).toBe(96.99); // 32.33 * 3
    });

    it("never exposes solicitation/factory data on the customer-facing request detail", async () => {
      const { id } = await submitAndSendToFactories([vendorId]);
      const { rows } = await sourcingService.listSolicitationsForVendor(vendorId);
      await sourcingService.respondToSolicitation(rows[0]!.id, vendorId, { canFulfil: true, proposedQuantity: 100, unitPrice: 30, notes: "Confidential factory note" });

      const customerDetail = await sourcingService.getDetailForCustomer(id, customerAId);
      const serialized = JSON.stringify(customerDetail);
      expect(serialized).not.toContain("Confidential factory note");
      expect(customerDetail).not.toHaveProperty("solicitations");
    });
  });
});
