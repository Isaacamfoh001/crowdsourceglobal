import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { resolutionsService } from "./service";
import { mockRefundExecutor } from "../refunds/mockExecutor";
import { moolreRefundExecutor } from "../refunds/moolreExecutor";

/** Integration tests against the real local Postgres dev database. */
describe("resolutionsService", () => {
  let categoryId: string;
  let vendorId: string;
  let listingId: string;
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

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const category = await prisma.category.create({ data: { name: "Resolution Test Category", slug: `res-cat-${suffix}` } });
    categoryId = category.id;
    createdIds.categories.push(category.id);

    const vendor = await prisma.vendor.create({
      data: { companyName: `Resolution Test Vendor ${suffix}`, storefrontSlug: `res-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    vendorId = vendor.id;
    createdIds.vendors.push(vendor.id);

    const listing = await prisma.vendorListing.create({
      data: {
        title: "Resolution Test Listing",
        description: "A test listing.",
        basePrice: 50,
        vendorId,
        categoryId,
        availableQuantity: 100,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });
    listingId = listing.id;
    createdIds.listings.push(listing.id);

    const customerUser = await prisma.user.create({
      data: { id: `res-customer-${suffix}`, name: "Resolution Customer", email: `res.customer.${suffix}@example.com` },
    });
    customerUserId = customerUser.id;
    createdIds.users.push(customerUser.id);

    const customerProfile = await prisma.customerProfile.create({ data: { userId: customerUserId, displayName: "Resolution Customer" } });
    customerProfileId = customerProfile.id;
    createdIds.customerProfiles.push(customerProfile.id);
  });

  afterAll(async () => {
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ customerProfileId: { in: createdIds.customerProfiles } }, { vendorId: { in: createdIds.vendors } }] },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);
    await prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } });
    await prisma.resolutionCaseItem.deleteMany({ where: { orderItem: { orderId: { in: createdIds.orders } } } });
    await prisma.resolutionCaseActivity.deleteMany({ where: { resolutionCase: { orderId: { in: createdIds.orders } } } });
    await prisma.refund.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.return.deleteMany({ where: { resolutionCase: { orderId: { in: createdIds.orders } } } });
    await prisma.replacement.deleteMany({ where: { resolutionCase: { orderId: { in: createdIds.orders } } } });
    await prisma.resolutionCase.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.vendorFinancialAdjustment.deleteMany({ where: { vendorEarning: { orderId: { in: createdIds.orders } } } });
    await prisma.vendorEarning.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdIds.orders } } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdIds.orders } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: createdIds.orders } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdIds.customerProfiles } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdIds.listings } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdIds.vendors } } });
    await prisma.category.deleteMany({ where: { id: { in: createdIds.categories } } });
    await prisma.$disconnect();
  });

  /** A confirmed, paid order with one Fulfilment/FulfilmentItem in the given status, backed by a real listing (so restock/replacement can be exercised). */
  async function createOrder(quantity: number, fulfilmentStatus: string, unitPrice = 50) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-RES-${suffix}`,
        customerProfileId,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: unitPrice * quantity,
        total: unitPrice * quantity,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "Resolution Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdIds.orders.push(order.id);

    const orderItem = await prisma.orderItem.create({
      data: { orderId: order.id, listingId, vendorId, description: "Resolution Test Listing", quantity, unitPrice, vendorPayableBasis: unitPrice * 0.7, lineTotal: unitPrice * quantity },
    });

    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId, origin: "DOMESTIC_COLLECTION", status: fulfilmentStatus as never } });
    const fulfilmentItem = await prisma.fulfilmentItem.create({
      data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity, unitPrice, vendorPayableBasis: unitPrice * 0.7 * quantity },
    });
    await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id } });

    // Reserve stock the same way checkout does, so cancellation-restock has something real to release.
    await prisma.vendorListing.update({ where: { id: listingId }, data: { availableQuantity: { decrement: quantity } } });
    await prisma.inventoryReservation.create({
      data: { listingId, orderId: order.id, quantity, status: "COMMITTED", expiresAt: new Date(Date.now() + 60_000) },
    });

    return { order, orderItem, fulfilment, fulfilmentItem };
  }

  async function submitAndReview(orderId: string, orderItemId: string, quantity: number, issueType: string = "ITEM_DAMAGED") {
    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: issueType as never,
      description: "Something went wrong with this item.",
      items: [{ orderItemId, quantity }],
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) throw new Error("setup failed");
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    return submitted.value.caseId;
  }

  // ---- Case creation ------------------------------------------------------

  it("a customer can only create a case for their own order", async () => {
    const { order, orderItem } = await createOrder(2, "PENDING");
    const otherCustomer = await prisma.customerProfile.create({
      data: { userId: (await prisma.user.create({ data: { id: `res-other-${Date.now()}`, name: "Other", email: `res.other.${Date.now()}@example.com` } })).id, displayName: "Other" },
    });
    createdIds.customerProfiles.push(otherCustomer.id);

    const result = await resolutionsService.submitCase(otherCustomer.id, otherCustomer.userId, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "Not my order but trying anyway.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    expect(result.ok).toBe(false);
  });

  it("creates ResolutionCaseItems with the correct affected quantity", async () => {
    const { order, orderItem } = await createOrder(5, "DELIVERED");
    const result = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "Two units arrived damaged.",
      items: [{ orderItemId: orderItem.id, quantity: 2 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = await resolutionsService.getForCustomer(customerProfileId, result.value.caseId);
    expect(detail?.items[0]?.quantityAffected).toBe(2);
    expect(detail?.items[0]?.purchasedQuantity).toBe(5);
  });

  it("rejects a duplicate case for the same item + issue while one is still open, but allows a new one once resolved", async () => {
    const { order, orderItem } = await createOrder(3, "DELIVERED");
    const first = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "Damaged on arrival.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    expect(first.ok).toBe(true);

    const duplicate = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "Same issue again.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    expect(duplicate.ok).toBe(false);

    if (first.ok) {
      await resolutionsService.moveToUnderReview("staff-1", first.value.caseId);
      await resolutionsService.rejectCase("staff-1", first.value.caseId, "Not eligible.");
    }

    const afterResolution = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "A genuinely new report after the first case closed.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    expect(afterResolution.ok).toBe(true);
  });

  it("blocks a cancellation request once the fulfilment has been delivered", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const result = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId: order.id,
      issueType: "CUSTOMER_CANCELLATION_REQUEST",
      description: "I want to cancel this now.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    expect(result.ok).toBe(false);
  });

  it("allows a cancellation request while the fulfilment is still PENDING", async () => {
    const { order, orderItem } = await createOrder(1, "PENDING");
    const result = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId: order.id,
      issueType: "CUSTOMER_CANCELLATION_REQUEST",
      description: "Changed my mind.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    expect(result.ok).toBe(true);
  });

  // ---- Case state machine ---------------------------------------------------

  it("rejects an invalid state skip (OPEN straight to RESOLUTION_APPROVED via approveResolution)", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "Damaged.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    const approval = await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 50 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });
    expect(approval.ok).toBe(false); // still OPEN, never moved to UNDER_REVIEW
  });

  it("supports the full happy path: OPEN → UNDER_REVIEW → RESOLUTION_APPROVED → RESOLVED → CLOSED", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    expect(detail?.status).toBe("UNDER_REVIEW");

    const approval = await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 50 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "We're sorry — refund approved.",
    });
    expect(approval.ok).toBe(true);

    const resolved = await resolutionsService.resolveCase("staff-1", caseId);
    expect(resolved.ok).toBe(true);
    const closed = await resolutionsService.closeCase("staff-1", caseId);
    expect(closed.ok).toBe(true);

    const final = await resolutionsService.getDetailForAdmin(caseId);
    expect(final?.status).toBe("CLOSED");
    expect(final?.resolvedAt).not.toBeNull();
    expect(final?.closedAt).not.toBeNull();
  });

  it("supports the AWAITING_CUSTOMER clarification round-trip", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1);

    // Messaging requires a real User row (Message.senderUserId has a DB FK) —
    // unlike ResolutionCaseActivity.actorUserId, which is a plain string.
    const staffUser = await prisma.user.create({ data: { id: `res-staff-${Date.now()}`, name: "Staff", email: `res.staff.${Date.now()}@example.com` } });
    createdIds.users.push(staffUser.id);

    const clarify = await resolutionsService.requestCustomerClarification(staffUser.id, caseId, "Can you send a photo?");
    expect(clarify.ok).toBe(true);
    expect((await resolutionsService.getDetailForAdmin(caseId))?.status).toBe("AWAITING_CUSTOMER");

    const resume = await resolutionsService.resumeReview("staff-1", caseId);
    expect(resume.ok).toBe(true);
    expect((await resolutionsService.getDetailForAdmin(caseId))?.status).toBe("UNDER_REVIEW");
  });

  it("supports the AWAITING_VENDOR round-trip and creates a vendor-side conversation", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1, "WRONG_ITEM");

    const staffUser = await prisma.user.create({ data: { id: `res-staff2-${Date.now()}`, name: "Staff", email: `res.staff2.${Date.now()}@example.com` } });
    createdIds.users.push(staffUser.id);

    const ask = await resolutionsService.requestVendorResponse(staffUser.id, caseId, vendorId, "Can you confirm what was packed?");
    expect(ask.ok).toBe(true);
    expect((await resolutionsService.getDetailForAdmin(caseId))?.status).toBe("AWAITING_VENDOR");

    const conversation = await prisma.conversation.findFirst({ where: { participantType: "VENDOR", vendorId, contextResolutionCaseId: caseId } });
    expect(conversation).not.toBeNull();

    const resume = await resolutionsService.resumeReview(staffUser.id, caseId);
    expect(resume.ok).toBe(true);
  });

  it("rejects a case with a customer-visible reason", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const result = await resolutionsService.rejectCase("staff-1", caseId, "This falls outside our policy.");
    expect(result.ok).toBe(true);
    const detail = await resolutionsService.getForCustomer(customerProfileId, caseId);
    expect(detail?.status).toBe("REJECTED");
    expect(detail?.customerSafeDecisionReason).toBe("This falls outside our policy.");
  });

  // ---- Refund calculation, cap, idempotency --------------------------------

  it("computes a full refund from the historical OrderItem snapshot, not current listing pricing", async () => {
    const { order, orderItem } = await createOrder(2, "DELIVERED", 75);
    const caseId = await submitAndReview(order.id, orderItem.id, 2);

    // Live price changes after the order — must not affect the refund.
    await prisma.vendorListing.update({ where: { id: listingId }, data: { basePrice: 999 } });

    const detail = await resolutionsService.getDetailForAdmin(caseId);
    const approval = await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 150 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Refund approved.",
    });
    expect(approval.ok).toBe(true);
    const refunds = await prisma.refund.findMany({ where: { resolutionCaseId: caseId } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount.toNumber()).toBe(150); // 2 x 75, unaffected by the later basePrice change
  });

  it("caps cumulative approved refund across cases so it can never exceed the OrderItem's paid value", async () => {
    const { order, orderItem } = await createOrder(2, "DELIVERED", 100); // paid value = 200

    const caseA = await submitAndReview(order.id, orderItem.id, 1, "ITEM_DAMAGED");
    const detailA = await resolutionsService.getDetailForAdmin(caseA);
    const approvalA = await resolutionsService.approveResolution("staff-1", caseA, {
      items: [{ caseItemId: detailA!.items[0]!.id, approvedResolution: "PARTIAL_REFUND", approvedRefundAmount: 150 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Partial refund approved.",
    });
    expect(approvalA.ok).toBe(true); // 150 <= 200, fine on its own

    const caseB = await submitAndReview(order.id, orderItem.id, 1, "WRONG_ITEM");
    const detailB = await resolutionsService.getDetailForAdmin(caseB);
    const approvalB = await resolutionsService.approveResolution("staff-1", caseB, {
      items: [{ caseItemId: detailB!.items[0]!.id, approvedResolution: "PARTIAL_REFUND", approvedRefundAmount: 100 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Another refund attempt.",
    });
    expect(approvalB.ok).toBe(false); // 150 + 100 = 250 > 200 paid — must be rejected
  });

  it("processes a mock refund to COMPLETED, and a simulated failure to FAILED without losing the case", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED", 60);
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 60 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });
    const refund = await prisma.refund.findFirstOrThrow({ where: { resolutionCaseId: caseId } });

    const processed = await resolutionsService.processRefund("staff-1", refund.id, "succeed", mockRefundExecutor);
    expect(processed.ok).toBe(true);
    const completed = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.processedAt).not.toBeNull();
  });

  it("a simulated refund failure marks it FAILED and does not silently disappear", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED", 60);
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 60 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });
    const refund = await prisma.refund.findFirstOrThrow({ where: { resolutionCaseId: caseId } });

    await resolutionsService.processRefund("staff-1", refund.id, "fail", mockRefundExecutor);
    const failed = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).not.toBeNull();
  });

  it("refund processing is claim-guarded — a refund already PROCESSING/COMPLETED cannot be re-claimed", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED", 60);
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 60 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });
    const refund = await prisma.refund.findFirstOrThrow({ where: { resolutionCaseId: caseId } });

    await resolutionsService.processRefund("staff-1", refund.id, "succeed", mockRefundExecutor);
    const secondAttempt = await resolutionsService.processRefund("staff-1", refund.id, "succeed", mockRefundExecutor);
    expect(secondAttempt.ok).toBe(false); // already COMPLETED — cannot be claimed again, no duplicate execution
  });

  // ---- Provider-aware refund executor routing (M10A) -----------------------

  it("moolre-mode refund execution fails closed: never COMPLETED, never invokes MockRefundExecutor, preserves the approved Refund for manual handling", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED", 60);
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 60 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });
    const refundBefore = await prisma.refund.findFirstOrThrow({ where: { resolutionCaseId: caseId } });
    expect(refundBefore.status).toBe("APPROVED");
    expect(refundBefore.amount.toNumber()).toBe(60); // original M9 calculation untouched by executor routing

    const mockRefundSpy = vi.spyOn(mockRefundExecutor, "refund");

    const result = await resolutionsService.processRefund("staff-1", refundBefore.id, "succeed", moolreRefundExecutor);

    expect(result.ok).toBe(true); // processRefund itself succeeds as an operation — the REFUND is what stays unresolved
    expect(mockRefundSpy).not.toHaveBeenCalled(); // moolre mode never falls back to the mock executor

    const refundAfter = await prisma.refund.findUniqueOrThrow({ where: { id: refundBefore.id } });
    expect(refundAfter.status).not.toBe("COMPLETED"); // no money movement was ever simulated
    expect(refundAfter.status).toBe("FAILED"); // preserved for manual operational handling, not silently lost
    expect(refundAfter.failureReason).toMatch(/manual/i);
    expect(refundAfter.amount.toNumber()).toBe(60); // amount/state otherwise unchanged

    mockRefundSpy.mockRestore();
  });

  it("moolre-mode refund failure is retryable exactly like a mock failure — the claim guard doesn't distinguish executors", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED", 40);
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 40 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved.",
    });
    const refund = await prisma.refund.findFirstOrThrow({ where: { resolutionCaseId: caseId } });

    await resolutionsService.processRefund("staff-1", refund.id, "succeed", moolreRefundExecutor);
    const failed = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(failed.status).toBe("FAILED");

    // Once a real refund API exists and an operator retries with the real
    // executor, the same claim-guard mechanism must still allow it — proving
    // moolre mode's fail-closed result doesn't corrupt the retry pathway.
    const retry = await resolutionsService.processRefund("staff-1", refund.id, "succeed", mockRefundExecutor);
    expect(retry.ok).toBe(true);
    const completed = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(completed.status).toBe("COMPLETED");
  });

  // ---- Cancellation + inventory --------------------------------------------

  it("cancelling a PENDING fulfilment releases inventory back to the listing", async () => {
    const { order, orderItem, fulfilment } = await createOrder(3, "PENDING");
    const before = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });

    const caseId = await submitAndReview(order.id, orderItem.id, 3, "CUSTOMER_CANCELLATION_REQUEST");
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    const approval = await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 150 }],
      responsibility: "CROWNSOURCE",
      customerSafeDecisionReason: "Cancelled as requested.",
      cancelFulfilmentId: fulfilment.id,
    });
    expect(approval.ok).toBe(true);

    const cancelledFulfilment = await prisma.fulfilment.findUniqueOrThrow({ where: { id: fulfilment.id } });
    expect(cancelledFulfilment.status).toBe("CANCELLED");

    const after = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(after.availableQuantity).toBe(before.availableQuantity + 3);

    const reservation = await prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: order.id } });
    expect(reservation.status).toBe("RELEASED");
  });

  it("does not restock inventory for a damaged-item refund with no cancellation — inventory stays as-is", async () => {
    const { order, orderItem } = await createOrder(2, "DELIVERED");
    const before = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });

    const caseId = await submitAndReview(order.id, orderItem.id, 1, "ITEM_DAMAGED");
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 50 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Refund approved — no restock, item was damaged in the field.",
    });

    const after = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(after.availableQuantity).toBe(before.availableQuantity); // unchanged
  });

  it("rejects cancelling a fulfilment that has already progressed past the cancellable window", async () => {
    const { order, orderItem, fulfilment } = await createOrder(1, "DISPATCHED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1, "CUSTOMER_CANCELLATION_REQUEST");
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    const approval = await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "NO_ACTION" }],
      responsibility: "CROWNSOURCE",
      customerSafeDecisionReason: "Attempting cancellation.",
      cancelFulfilmentId: fulfilment.id,
    });
    expect(approval.ok).toBe(false);
  });

  // ---- Return lifecycle + restock decision ---------------------------------

  it("a RETURN_AND_REFUND decision creates a Return, and RESELLABLE inspection restocks inventory exactly once", async () => {
    const { order, orderItem } = await createOrder(2, "DELIVERED");
    const before = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });

    const caseId = await submitAndReview(order.id, orderItem.id, 1, "ITEM_NOT_AS_DESCRIBED");
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "RETURN_AND_REFUND", approvedRefundAmount: 50 }],
      responsibility: "CUSTOMER",
      customerSafeDecisionReason: "Please return the item for a refund.",
    });

    const ret = await prisma.return.findFirstOrThrow({ where: { resolutionCaseId: caseId } });
    expect(ret.status).toBe("APPROVED");

    await resolutionsService.recordReturnTransit("staff-1", ret.id, { method: "courier pickup" });
    await resolutionsService.confirmReturnReceived("staff-1", ret.id);
    await resolutionsService.inspectReturn("staff-1", ret.id, "RESELLABLE", "Good condition.");

    const afterFirstInspection = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(afterFirstInspection.availableQuantity).toBe(before.availableQuantity + 1);

    const inspectedReturn = await prisma.return.findUniqueOrThrow({ where: { id: ret.id } });
    expect(inspectedReturn.restockedAt).not.toBeNull();

    // Idempotency: completing the return afterward must not restock a second time.
    await resolutionsService.completeReturn("staff-1", ret.id);
    const afterComplete = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(afterComplete.availableQuantity).toBe(before.availableQuantity + 1); // unchanged from the first restock
  });

  it("a NOT_RESELLABLE inspection does not restock inventory", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const before = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });

    const caseId = await submitAndReview(order.id, orderItem.id, 1, "ITEM_DAMAGED");
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "RETURN_AND_REFUND", approvedRefundAmount: 50 }],
      responsibility: "CUSTOMER",
      customerSafeDecisionReason: "Please return for inspection.",
    });
    const ret = await prisma.return.findFirstOrThrow({ where: { resolutionCaseId: caseId } });
    await resolutionsService.recordReturnTransit("staff-1", ret.id, { method: "courier pickup" });
    await resolutionsService.confirmReturnReceived("staff-1", ret.id);
    await resolutionsService.inspectReturn("staff-1", ret.id, "NOT_RESELLABLE", "Beyond repair.");

    const after = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(after.availableQuantity).toBe(before.availableQuantity); // unchanged
  });

  // ---- Replacement ----------------------------------------------------------

  it("a REPLACEMENT decision creates a Replacement record; creating the fulfilment produces a zero-value OrderItem and reserves stock", async () => {
    const { order, orderItem } = await createOrder(3, "DELIVERED");
    const beforeStock = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });

    const caseId = await submitAndReview(order.id, orderItem.id, 1, "WRONG_ITEM");
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "REPLACEMENT", replacementQuantity: 1 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "We'll send the correct item.",
    });

    const replacement = await prisma.replacement.findFirstOrThrow({ where: { resolutionCaseId: caseId } });
    expect(replacement.quantity).toBe(1);
    expect(replacement.replacementOrderItemId).toBeNull();

    const created = await resolutionsService.createReplacementFulfilment("staff-1", replacement.id);
    expect(created.ok).toBe(true);

    const updatedReplacement = await prisma.replacement.findUniqueOrThrow({ where: { id: replacement.id } });
    expect(updatedReplacement.replacementOrderItemId).not.toBeNull();

    const replacementOrderItem = await prisma.orderItem.findUniqueOrThrow({ where: { id: updatedReplacement.replacementOrderItemId! } });
    expect(replacementOrderItem.unitPrice.toNumber()).toBe(0);
    expect(replacementOrderItem.lineTotal.toNumber()).toBe(0); // no fake customer charge

    const afterStock = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(afterStock.availableQuantity).toBe(beforeStock.availableQuantity - 1); // replacement consumed inventory

    // Original order history is untouched.
    const originalItem = await prisma.orderItem.findUniqueOrThrow({ where: { id: orderItem.id } });
    expect(originalItem.quantity).toBe(3);
    expect(originalItem.lineTotal.toNumber()).toBe(150);
  });

  // ---- Payout hold interaction ----------------------------------------------

  it("sets payoutHold on the affected FulfilmentItem when responsibility is VENDOR and the decision is refund-bearing", async () => {
    const { order, orderItem, fulfilmentItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 50 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Vendor-fault refund.",
    });

    const item = await prisma.fulfilmentItem.findUniqueOrThrow({ where: { id: fulfilmentItem.id } });
    expect(item.payoutHold).toBe(true);
    expect(item.payoutHoldReason).toContain(detail!.caseNumber);
  });

  it("does not set payoutHold when responsibility is CROWNSOURCE (no-fault refund)", async () => {
    const { order, orderItem, fulfilmentItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const detail = await resolutionsService.getDetailForAdmin(caseId);
    await resolutionsService.approveResolution("staff-1", caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 50 }],
      responsibility: "CROWNSOURCE",
      customerSafeDecisionReason: "Our mistake — refund approved.",
    });

    const item = await prisma.fulfilmentItem.findUniqueOrThrow({ where: { id: fulfilmentItem.id } });
    expect(item.payoutHold).toBe(false);
  });

  // ---- Authorization / IDOR --------------------------------------------------

  it("Customer B cannot read Customer A's case", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1);

    const otherUser = await prisma.user.create({ data: { id: `res-idor-${Date.now()}`, name: "Other", email: `res.idor.${Date.now()}@example.com` } });
    createdIds.users.push(otherUser.id);
    const otherProfile = await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other" } });
    createdIds.customerProfiles.push(otherProfile.id);

    const result = await resolutionsService.getForCustomer(otherProfile.id, caseId);
    expect(result).toBeNull();
  });

  it("Vendor B cannot read a case affecting only Vendor A's fulfilment", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1);

    const otherVendor = await prisma.vendor.create({
      data: { companyName: `Other Vendor ${Date.now()}`, storefrontSlug: `other-vendor-${Date.now()}`, verificationStatus: "APPROVED" },
    });
    createdIds.vendors.push(otherVendor.id);

    const result = await resolutionsService.getForVendor(otherVendor.id, caseId);
    expect(result).toBeNull();

    const ownResult = await resolutionsService.getForVendor(vendorId, caseId);
    expect(ownResult).not.toBeNull();
  });

  it("a non-owning customer cannot upload evidence to another customer's case", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1);

    const otherUser = await prisma.user.create({ data: { id: `res-idor2-${Date.now()}`, name: "Other", email: `res.idor2.${Date.now()}@example.com` } });
    createdIds.users.push(otherUser.id);
    const otherProfile = await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other" } });
    createdIds.customerProfiles.push(otherProfile.id);

    const result = await resolutionsService.addAttachment(otherProfile.id, otherUser.id, caseId, {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      filename: "evidence.png",
      mimeType: "image/png",
    });
    expect(result.ok).toBe(false);
  });

  it("customer and vendor conversations on the same case are structurally separate — never one shared thread", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1, "WRONG_ITEM");

    const staffUser = await prisma.user.create({ data: { id: `res-staff3-${Date.now()}`, name: "Staff", email: `res.staff3.${Date.now()}@example.com` } });
    createdIds.users.push(staffUser.id);

    await resolutionsService.requestCustomerClarification(staffUser.id, caseId, "Quick question for you.");
    await resolutionsService.resumeReview(staffUser.id, caseId);
    await resolutionsService.requestVendorResponse(staffUser.id, caseId, vendorId, "Quick question for you too.");

    const conversations = await prisma.conversation.findMany({ where: { contextResolutionCaseId: caseId } });
    expect(conversations).toHaveLength(2);
    const customerThread = conversations.find((c) => c.participantType === "CUSTOMER");
    const vendorThread = conversations.find((c) => c.participantType === "VENDOR");
    expect(customerThread).toBeTruthy();
    expect(vendorThread).toBeTruthy();
    expect(customerThread!.id).not.toBe(vendorThread!.id);
  });

  it("the vendor-facing case view never includes the customer's description or contact details", async () => {
    const { order, orderItem } = await createOrder(1, "DELIVERED");
    const caseId = await submitAndReview(order.id, orderItem.id, 1);
    const vendorView = await resolutionsService.getForVendor(vendorId, caseId);
    expect(vendorView).not.toBeNull();
    expect(vendorView).not.toHaveProperty("customerDescription");
    expect(vendorView).not.toHaveProperty("customerEmail");
    expect(vendorView).not.toHaveProperty("customerName");
  });
});
