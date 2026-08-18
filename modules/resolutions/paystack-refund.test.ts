import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

const createRefund = vi.fn();
const fetchRefund = vi.fn();

vi.mock("../payments/providers/paystack/client", () => ({
  paystackClient: {
    createRefund: (...args: unknown[]) => createRefund(...args),
    fetchRefund: (...args: unknown[]) => fetchRefund(...args),
  },
}));

const { resolutionsService } = await import("./service");

/** Integration tests against the real local Postgres dev database, with the Paystack HTTP boundary mocked. */
describe("resolutionsService — Paystack refunds (M10A.2)", () => {
  let categoryId: string;
  let vendorId: string;
  let listingId: string;
  let customerUserId: string;
  let customerProfileId: string;
  const createdIds = { categories: [] as string[], vendors: [] as string[], listings: [] as string[], users: [] as string[], customerProfiles: [] as string[], orders: [] as string[], payments: [] as string[] };

  beforeEach(() => {
    createRefund.mockReset();
    fetchRefund.mockReset();
  });

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "Paystack Refund Test Category", slug: `pr-cat-${suffix}` } });
    categoryId = category.id;
    createdIds.categories.push(category.id);
    const vendor = await prisma.vendor.create({ data: { companyName: `PR Vendor ${suffix}`, storefrontSlug: `pr-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    vendorId = vendor.id;
    createdIds.vendors.push(vendor.id);
    const listing = await prisma.vendorListing.create({
      data: { title: "PR Test Listing", description: "Fixture.", basePrice: 50, vendorId, categoryId, availableQuantity: 100, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    listingId = listing.id;
    createdIds.listings.push(listing.id);
    const user = await prisma.user.create({ data: { id: `pr-customer-${suffix}`, name: "PR Customer", email: `pr.customer.${suffix}@example.com` } });
    customerUserId = user.id;
    createdIds.users.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: customerUserId, displayName: "PR Customer" } });
    customerProfileId = customer.id;
    createdIds.customerProfiles.push(customer.id);
  });

  afterAll(async () => {
    await prisma.resolutionCaseItem.deleteMany({ where: { orderItem: { orderId: { in: createdIds.orders } } } });
    await prisma.resolutionCaseActivity.deleteMany({ where: { resolutionCase: { orderId: { in: createdIds.orders } } } });
    await prisma.refund.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.resolutionCase.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdIds.orders } } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdIds.orders } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: createdIds.orders } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdIds.customerProfiles } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdIds.listings } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdIds.vendors } } });
    await prisma.category.deleteMany({ where: { id: { in: createdIds.categories } } });
    await prisma.$disconnect();
  });

  async function createPaystackPaidOrderWithApprovedRefund(unitPrice: number, refundAmount: number) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-PR-${suffix}`,
        customerProfileId,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: unitPrice,
        total: unitPrice,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "PR Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdIds.orders.push(order.id);

    const payment = await prisma.payment.create({
      data: { orderId: order.id, reference: `PAY-PR-${suffix}`, provider: "PAYSTACK", method: "MOBILE_MONEY", network: "MTN", amount: unitPrice, currency: "GHS", status: "SUCCEEDED", confirmedAt: new Date() },
    });

    const orderItem = await prisma.orderItem.create({
      data: { orderId: order.id, listingId, vendorId, description: "PR Test Listing", quantity: 1, unitPrice, vendorPayableBasis: unitPrice * 0.7, lineTotal: unitPrice },
    });
    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId, origin: "DOMESTIC_COLLECTION", status: "DELIVERED" } });
    await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 1, unitPrice, vendorPayableBasis: unitPrice * 0.7 } });
    await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id } });

    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "Damaged on arrival.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: refundAmount }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });

    const refund = await prisma.refund.findFirstOrThrow({ where: { resolutionCaseId: submitted.value.caseId } });
    return { orderId: order.id, paymentId: payment.id, caseId: submitted.value.caseId, refundId: refund.id };
  }

  it("selects PaystackRefundExecutor for a Paystack-paid order, stays PROCESSING (never COMPLETED) on acceptance, and passes the approved amount converted to pesewas", async () => {
    const { paymentId, refundId } = await createPaystackPaidOrderWithApprovedRefund(60, 60);
    createRefund.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { id: 9001, transaction: paymentId, amount: 6000, currency: "GHS", status: "pending" } } });

    const result = await resolutionsService.processRefund("staff-1", refundId, "succeed");
    expect(result.ok).toBe(true);
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 6000, currency: "GHS" }));

    const refund = await prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    expect(refund.status).toBe("PROCESSING");
    expect(refund.providerEventId).toBe("9001");
  });

  it("reconciliation moves a PENDING Paystack refund to COMPLETED once Paystack reports it processed", async () => {
    const { refundId } = await createPaystackPaidOrderWithApprovedRefund(80, 80);
    createRefund.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { id: 9002, transaction: "x", amount: 8000, currency: "GHS", status: "pending" } } });
    await resolutionsService.processRefund("staff-1", refundId, "succeed");

    fetchRefund.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { id: 9002, transaction: "x", amount: 8000, currency: "GHS", status: "processed" } } });
    const reconciled = await resolutionsService.reconcilePaystackRefund(refundId);
    expect(reconciled.ok).toBe(true);

    const refund = await prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    expect(refund.status).toBe("COMPLETED");
    expect(refund.processedAt).not.toBeNull();
  });

  it("reconciliation moves a PENDING Paystack refund to FAILED when Paystack reports it failed", async () => {
    const { refundId } = await createPaystackPaidOrderWithApprovedRefund(30, 30);
    createRefund.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { id: 9003, transaction: "x", amount: 3000, currency: "GHS", status: "pending" } } });
    await resolutionsService.processRefund("staff-1", refundId, "succeed");

    fetchRefund.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { id: 9003, transaction: "x", amount: 3000, currency: "GHS", status: "failed" } } });
    await resolutionsService.reconcilePaystackRefund(refundId);

    const refund = await prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    expect(refund.status).toBe("FAILED");
  });

  it("reconciling an already-COMPLETED refund is a safe idempotent no-op — never issues a second createRefund call", async () => {
    const { refundId } = await createPaystackPaidOrderWithApprovedRefund(50, 50);
    createRefund.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { id: 9004, transaction: "x", amount: 5000, currency: "GHS", status: "pending" } } });
    await resolutionsService.processRefund("staff-1", refundId, "succeed");
    fetchRefund.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { id: 9004, transaction: "x", amount: 5000, currency: "GHS", status: "processed" } } });
    await resolutionsService.reconcilePaystackRefund(refundId);

    await resolutionsService.reconcilePaystackRefund(refundId);
    expect(fetchRefund).toHaveBeenCalledTimes(1);
    expect(createRefund).toHaveBeenCalledTimes(1);
  });

  it("partial refund: the approved (partial) amount, not the full order total, is sent to Paystack", async () => {
    const { refundId } = await createPaystackPaidOrderWithApprovedRefund(100, 40);
    createRefund.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { id: 9005, transaction: "x", amount: 4000, currency: "GHS", status: "pending" } } });
    await resolutionsService.processRefund("staff-1", refundId, "succeed");
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 4000 }));
  });

  it("a create-refund HTTP failure marks the Refund FAILED, never COMPLETED, and never issues a duplicate refund on immediate re-processing", async () => {
    const { refundId } = await createPaystackPaidOrderWithApprovedRefund(20, 20);
    createRefund.mockResolvedValueOnce({ ok: false, kind: "HTTP_ERROR", status: 400 });
    await resolutionsService.processRefund("staff-1", refundId, "succeed");
    const refund = await prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    expect(refund.status).toBe("FAILED");

    createRefund.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { id: 9006, transaction: "x", amount: 2000, currency: "GHS", status: "pending" } } });
    await resolutionsService.processRefund("staff-1", refundId, "succeed");
    expect(createRefund).toHaveBeenCalledTimes(2); // FAILED is retryable — this is an intentional retry, not a duplicate
    const retried = await prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    expect(retried.status).toBe("PROCESSING");
  });
});
