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

  it("rejects a request with no title", async () => {
    const result = await submit(customerAId, customerAEmail, { title: "" });
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
});
