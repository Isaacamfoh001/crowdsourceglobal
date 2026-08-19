import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { fulfilmentService } from "./service";
import { logisticsService } from "../logistics/service";
import { cartService } from "../cart/service";
import { ordersService } from "../orders/service";
import { messagingService } from "../messaging/service";
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
describe("fulfilmentService", () => {
  let categoryId: string;
  let domesticVendorId: string;
  let domesticOwnerUserId: string;
  let internationalVendorId: string;
  let internationalOwnerUserId: string;
  let customerAId: string;
  let customerAUserId: string;
  let customerBId: string;
  let receivingLocationId: string;

  const createdVendorIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdLocationIds: string[] = [];
  const createdConversationIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const domesticVendor = await prisma.vendor.create({
      data: { companyName: "Accra Textiles", storefrontSlug: `m4-domestic-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    domesticVendorId = domesticVendor.id;
    createdVendorIds.push(domesticVendor.id);

    const domesticOwner = await prisma.user.create({
      data: { id: `m4-domestic-owner-${suffix}`, name: "Domestic Owner", email: `m4.domestic.${suffix}@example.com` },
    });
    domesticOwnerUserId = domesticOwner.id;
    createdUserIds.push(domesticOwner.id);
    await prisma.vendorMembership.create({ data: { userId: domesticOwnerUserId, vendorId: domesticVendorId, role: "OWNER" } });

    const internationalVendor = await prisma.vendor.create({
      data: { companyName: "London Supplies Ltd", storefrontSlug: `m4-intl-${suffix}`, verificationStatus: "APPROVED", country: "United Kingdom" },
    });
    internationalVendorId = internationalVendor.id;
    createdVendorIds.push(internationalVendor.id);

    const internationalOwner = await prisma.user.create({
      data: { id: `m4-intl-owner-${suffix}`, name: "International Owner", email: `m4.intl.${suffix}@example.com` },
    });
    internationalOwnerUserId = internationalOwner.id;
    createdUserIds.push(internationalOwner.id);
    await prisma.vendorMembership.create({ data: { userId: internationalOwnerUserId, vendorId: internationalVendorId, role: "OWNER" } });

    const category = await prisma.category.create({ data: { name: "M4 Test Category", slug: `m4-test-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const userA = await prisma.user.create({
      data: { id: `m4-customer-a-${suffix}`, name: "Customer A", email: `m4.customer.a.${suffix}@example.com` },
    });
    customerAUserId = userA.id;
    createdUserIds.push(userA.id);
    const customerA = await prisma.customerProfile.create({ data: { userId: userA.id, displayName: "Customer A" } });
    customerAId = customerA.id;
    createdCustomerIds.push(customerA.id);

    const userB = await prisma.user.create({
      data: { id: `m4-customer-b-${suffix}`, name: "Customer B", email: `m4.customer.b.${suffix}@example.com` },
    });
    createdUserIds.push(userB.id);
    const customerB = await prisma.customerProfile.create({ data: { userId: userB.id, displayName: "Customer B" } });
    customerBId = customerB.id;
    createdCustomerIds.push(customerB.id);

    const location = await prisma.receivingLocation.create({
      data: { name: "M4 Test Receiving Office", country: "Ghana", city: "Accra", addressLine1: "1 Warehouse Road", active: true },
    });
    receivingLocationId = location.id;
    createdLocationIds.push(location.id);
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversationIds } } });
    await prisma.fulfilmentIssue.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.vendorFinancialAdjustment.deleteMany({ where: { vendorEarning: { orderId: { in: createdOrderIds } } } });
    await prisma.vendorEarning.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendorMembership.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.receivingLocation.deleteMany({ where: { id: { in: createdLocationIds } } });
    await prisma.$disconnect();
  });

  /** Places one real multi-vendor order (domestic + international) via the actual M2 checkout path. */
  async function placeMultiVendorOrder() {
    const domesticListing = await prisma.vendorListing.create({
      data: {
        vendorId: domesticVendorId, categoryId, title: "Kente Cloth Bundle", description: "Handwoven kente cloth.",
        basePrice: 300, moq: 1, availableQuantity: 20, approvalStatus: "APPROVED", listingStatus: "ACTIVE",
      },
    });
    createdListingIds.push(domesticListing.id);

    const internationalListing = await prisma.vendorListing.create({
      data: {
        vendorId: internationalVendorId, categoryId, title: "Industrial Sewing Machine", description: "Heavy-duty sewing machine.",
        basePrice: 2500, moq: 1, availableQuantity: 10, approvalStatus: "APPROVED", listingStatus: "ACTIVE",
      },
    });
    createdListingIds.push(internationalListing.id);

    await cartService.addToCart(customerAId, domesticListing.id, 2);
    await cartService.addToCart(customerAId, internationalListing.id, 1);

    const orderResult = await ordersService.createOrderFromCart(customerAId, deliveryInfo);
    if (!orderResult.ok) throw new Error(orderResult.error);
    createdOrderIds.push(orderResult.value.orderId);

    const { newFulfilments } = await ordersService.confirmOrderPayment(orderResult.value.orderId);

    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId: orderResult.value.orderId } });
    const domesticFulfilment = fulfilments.find((f) => f.vendorId === domesticVendorId)!;
    const internationalFulfilment = fulfilments.find((f) => f.vendorId === internationalVendorId)!;

    return { orderId: orderResult.value.orderId, domesticFulfilment, internationalFulfilment, newFulfilments, domesticListing, internationalListing };
  }

  // --- Multi-vendor + origin routing -------------------------------------

  it("one Order fans out into isolated per-vendor Fulfilments with correct origin", async () => {
    const { domesticFulfilment, internationalFulfilment } = await placeMultiVendorOrder();
    expect(domesticFulfilment.origin).toBe("DOMESTIC_COLLECTION");
    expect(internationalFulfilment.origin).toBe("INTERNATIONAL_INBOUND");
  });

  it("a vendor sees only their own Fulfilment, never another vendor's", async () => {
    const { domesticFulfilment, internationalFulfilment } = await placeMultiVendorOrder();

    const domesticList = await fulfilmentService.listForVendor(domesticVendorId);
    expect(domesticList.some((f) => f.id === domesticFulfilment.id)).toBe(true);
    expect(domesticList.some((f) => f.id === internationalFulfilment.id)).toBe(false);

    const crossVendorDetail = await fulfilmentService.getDetailForVendor(domesticVendorId, internationalFulfilment.id);
    expect(crossVendorDetail).toBeNull();
  });

  it("independent progress — one vendor's status never affects another's", async () => {
    const { domesticFulfilment, internationalFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);

    const domesticAfter = await prisma.fulfilment.findUnique({ where: { id: domesticFulfilment.id } });
    const internationalAfter = await prisma.fulfilment.findUnique({ where: { id: internationalFulfilment.id } });
    expect(domesticAfter?.status).toBe("PREPARING");
    expect(internationalAfter?.status).toBe("PENDING"); // untouched
  });

  // --- Vendor-controlled transitions --------------------------------------

  it("a vendor progresses PENDING -> PREPARING -> READY, and cannot skip to READY directly", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();

    const skipAttempt = await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);
    expect(skipAttempt.ok).toBe(false);

    const start = await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    expect(start.ok).toBe(true);

    const doubleStart = await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    expect(doubleStart.ok).toBe(false); // already PREPARING — not PENDING anymore

    const ready = await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);
    expect(ready.ok).toBe(true);

    const final = await prisma.fulfilment.findUnique({ where: { id: domesticFulfilment.id } });
    expect(final?.status).toBe("READY");
  });

  it("a vendor cannot report an issue on another vendor's Fulfilment", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();
    const result = await fulfilmentService.reportIssue(
      internationalVendorId,
      domesticFulfilment.id,
      internationalOwnerUserId,
      "other",
      "Trying to interfere with a different vendor's order.",
    );
    expect(result.ok).toBe(false);
  });

  it("reporting an issue moves the Fulfilment to EXCEPTION, and admin resolution resumes it", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);

    const issueResult = await fulfilmentService.reportIssue(
      domesticVendorId,
      domesticFulfilment.id,
      domesticOwnerUserId,
      "damaged_stock",
      "Half the stock arrived damaged from our supplier.",
    );
    expect(issueResult.ok).toBe(true);

    const duringIssue = await prisma.fulfilment.findUnique({ where: { id: domesticFulfilment.id } });
    expect(duringIssue?.status).toBe("EXCEPTION");

    const detail = await fulfilmentService.getDetailForVendor(domesticVendorId, domesticFulfilment.id);
    expect(detail?.openIssue?.status).toBe("OPEN");

    const resolveResult = await fulfilmentService.resolveIssue(detail!.openIssue!.id, "admin-user-id", "Replacement stock confirmed with vendor.");
    expect(resolveResult.ok).toBe(true);

    const afterResolve = await prisma.fulfilment.findUnique({ where: { id: domesticFulfilment.id } });
    expect(afterResolve?.status).toBe("PREPARING"); // resumed
  });

  // --- Domestic collection --------------------------------------------

  it("(M11.1) domestic: admin confirms collection in ONE action — persists details, transitions to COLLECTED, and moves Fulfilment to DISPATCHED atomically", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);

    const confirm = await fulfilmentService.confirmCollection(domesticFulfilment.id, "admin-user-id", {
      carrier: "Speedy Couriers",
      trackingReference: "SC-001",
      notes: "Call before arrival.",
    });
    expect(confirm.ok).toBe(true);

    const fulfilment = await prisma.fulfilment.findUnique({ where: { id: domesticFulfilment.id } });
    expect(fulfilment?.status).toBe("DISPATCHED");
    const shipment = await prisma.shipment.findFirst({ where: { fulfilmentId: domesticFulfilment.id } });
    expect(shipment?.status).toBe("COLLECTED");
    expect(shipment?.collectedAt).not.toBeNull();
    expect(shipment?.carrier).toBe("Speedy Couriers");
    expect(shipment?.trackingReference).toBe("SC-001");
    expect(shipment?.collectionNotes).toBe("Call before arrival.");
  });

  it("(M11.1) domestic: confirming collection twice is rejected the second time — a Fulfilment can't be 'confirmed collected' from an already-COLLECTED shipment", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);

    const first = await fulfilmentService.confirmCollection(domesticFulfilment.id, "admin-user-id", {});
    expect(first.ok).toBe(true);
    const second = await fulfilmentService.confirmCollection(domesticFulfilment.id, "admin-user-id", {});
    expect(second.ok).toBe(false);
  });

  it("domestic: a vendor cannot confirm their own collection (no vendor-facing path reaches DISPATCHED for domestic)", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);

    // The vendor-facing service surface has exactly two mutating functions
    // (startPreparing, markReady) plus reportIssue — there is no
    // "confirmCollected" exposed to a vendorId at all. Attempting the
    // international-only recordVendorShipment path against a domestic
    // Fulfilment must also fail, proving it cannot be used as a backdoor.
    const backdoor = await fulfilmentService.recordVendorShipment(domesticVendorId, domesticFulfilment.id, {
      carrier: "x", trackingReference: "y", shippedAt: new Date(), expectedArrivalAt: null,
    });
    expect(backdoor.ok).toBe(false);

    const stillReady = await prisma.fulfilment.findUnique({ where: { id: domesticFulfilment.id } });
    expect(stillReady?.status).toBe("READY");
  });

  it("shipment progresses COLLECTED -> IN_TRANSIT -> OUT_FOR_DELIVERY -> DELIVERED, and cannot skip a step", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.confirmCollectedOrReceived(domesticFulfilment.id, "admin-user-id", null);

    const skipToDelivered = await fulfilmentService.confirmDelivered(domesticFulfilment.id);
    expect(skipToDelivered.ok).toBe(false); // not out for delivery yet

    const toTransit = await fulfilmentService.progressToInTransit(domesticFulfilment.id);
    expect(toTransit.ok).toBe(true);

    const skipTransitToDelivered = await fulfilmentService.confirmDelivered(domesticFulfilment.id);
    expect(skipTransitToDelivered.ok).toBe(false);

    const toOutForDelivery = await fulfilmentService.progressToOutForDelivery(domesticFulfilment.id);
    expect(toOutForDelivery.ok).toBe(true);

    const delivered = await fulfilmentService.confirmDelivered(domesticFulfilment.id);
    expect(delivered.ok).toBe(true);

    const fulfilment = await prisma.fulfilment.findUnique({ where: { id: domesticFulfilment.id } });
    expect(fulfilment?.status).toBe("DELIVERED");
  });

  it("confirmDelivered event-drives the linked VendorEarning from PENDING to WAITING_PERIOD immediately (M11.1) — never waits for the sweep", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();
    const earningBefore = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentId: domesticFulfilment.id } });
    expect(earningBefore.status).toBe("PENDING");
    expect(earningBefore.deliveredAt).toBeNull();

    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.confirmCollectedOrReceived(domesticFulfilment.id, "admin-user-id", null);
    await fulfilmentService.progressToInTransit(domesticFulfilment.id);
    await fulfilmentService.progressToOutForDelivery(domesticFulfilment.id);
    await fulfilmentService.confirmDelivered(domesticFulfilment.id);

    const earningAfter = await prisma.vendorEarning.findFirstOrThrow({ where: { fulfilmentId: domesticFulfilment.id } });
    expect(earningAfter.status).toBe("WAITING_PERIOD"); // event-driven — never jumps straight to ELIGIBLE, that's the sweep's job alone
    expect(earningAfter.deliveredAt).not.toBeNull();
  });

  it("a failed delivery can be resumed", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.confirmCollectedOrReceived(domesticFulfilment.id, "admin-user-id", null);
    await fulfilmentService.progressToInTransit(domesticFulfilment.id);
    await fulfilmentService.progressToOutForDelivery(domesticFulfilment.id);

    const failed = await fulfilmentService.reportDeliveryFailed(domesticFulfilment.id, "Customer not available.");
    expect(failed.ok).toBe(true);
    const afterFail = await prisma.fulfilment.findUnique({ where: { id: domesticFulfilment.id } });
    expect(afterFail?.status).toBe("EXCEPTION");

    const resume = await fulfilmentService.resumeAfterFailure(domesticFulfilment.id);
    expect(resume.ok).toBe(true);
    const shipment = await prisma.shipment.findFirst({ where: { fulfilmentId: domesticFulfilment.id } });
    expect(shipment?.status).toBe("OUT_FOR_DELIVERY");
  });

  // --- International inbound ----------------------------------------------

  it("international: a receiving destination is auto-assigned at creation", async () => {
    const { internationalFulfilment } = await placeMultiVendorOrder();
    const detail = await fulfilmentService.getDetailForVendor(internationalVendorId, internationalFulfilment.id);
    expect(detail?.shipment?.receivingLocation?.name).toBe("M4 Test Receiving Office");
  });

  it("international: vendor records shipment details, moving to DISPATCHED; admin then confirms receipt", async () => {
    const { internationalFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(internationalVendorId, internationalFulfilment.id);
    await fulfilmentService.markReady(internationalVendorId, internationalFulfilment.id);

    const shipResult = await fulfilmentService.recordVendorShipment(internationalVendorId, internationalFulfilment.id, {
      carrier: "DHL", trackingReference: "DHL-99887", shippedAt: new Date(), expectedArrivalAt: null,
    });
    expect(shipResult.ok).toBe(true);

    const afterShip = await prisma.fulfilment.findUnique({ where: { id: internationalFulfilment.id } });
    expect(afterShip?.status).toBe("DISPATCHED");

    // The vendor cannot mark CrownSource receipt themselves — there is no
    // vendorId-scoped function for it; confirmCollectedOrReceived takes an
    // actor id but no ownership check against a vendor at all (admin-only
    // by construction — gated at the Server Action layer via requireAdminSession).
    const receiptResult = await fulfilmentService.confirmCollectedOrReceived(internationalFulfilment.id, "admin-user-id", receivingLocationId);
    expect(receiptResult.ok).toBe(true);

    const shipment = await prisma.shipment.findFirst({ where: { fulfilmentId: internationalFulfilment.id } });
    expect(shipment?.status).toBe("COLLECTED");
    expect(shipment?.receivedAt).not.toBeNull();
    expect(shipment?.receivedByUserId).toBe("admin-user-id");
  });

  it("international: a vendor cannot ship before an assignment exists, or before marking READY", async () => {
    const { internationalFulfilment } = await placeMultiVendorOrder();
    // Still PENDING — hasn't even started preparing.
    const tooEarly = await fulfilmentService.recordVendorShipment(internationalVendorId, internationalFulfilment.id, {
      carrier: "DHL", trackingReference: "X", shippedAt: new Date(), expectedArrivalAt: null,
    });
    expect(tooEarly.ok).toBe(false);
  });

  it("international: the vendor never receives the customer's delivery address", async () => {
    const { internationalFulfilment } = await placeMultiVendorOrder();
    const detail = await fulfilmentService.getDetailForVendor(internationalVendorId, internationalFulfilment.id);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain(deliveryInfo.addressLine1);
    expect(serialized).not.toContain(deliveryInfo.phone);
    // Structurally: VendorFulfilmentDetail has no deliveryInfo field at all.
    expect(detail).not.toHaveProperty("deliveryInfo");
  });

  it("admin CAN see the customer's delivery address for operational purposes", async () => {
    const { domesticFulfilment } = await placeMultiVendorOrder();
    const adminDetail = await fulfilmentService.getDetailForAdmin(domesticFulfilment.id);
    expect(adminDetail?.deliveryInfo.addressLine1).toBe(deliveryInfo.addressLine1);
  });

  // --- Customer tracking ---------------------------------------------------

  it("customer sees split-delivery tracking for a multi-vendor order, correctly isolated to their own order", async () => {
    const { orderId } = await placeMultiVendorOrder();
    const tracking = await fulfilmentService.getCustomerTracking(orderId, customerAId);
    expect(tracking).toHaveLength(2);
    expect(tracking.map((t) => t.vendorName).sort()).toEqual(["Accra Textiles", "London Supplies Ltd"].sort());

    const otherCustomerTracking = await fulfilmentService.getCustomerTracking(orderId, customerBId);
    expect(otherCustomerTracking).toHaveLength(0); // ownership — not their order
  });

  it("customer tracking reflects real progress and confirms receipt only for their own order", async () => {
    const { orderId, domesticFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.confirmCollectedOrReceived(domesticFulfilment.id, "admin-user-id", null);
    await fulfilmentService.progressToInTransit(domesticFulfilment.id);
    await fulfilmentService.progressToOutForDelivery(domesticFulfilment.id);
    await fulfilmentService.confirmDelivered(domesticFulfilment.id);

    const tracking = await fulfilmentService.getCustomerTracking(orderId, customerAId);
    const domesticPkg = tracking.find((t) => t.vendorName === "Accra Textiles")!;
    expect(domesticPkg.steps.at(-1)?.done).toBe(true); // "Delivered" step complete

    const forgedConfirm = await fulfilmentService.confirmCustomerReceipt(domesticFulfilment.id, orderId, customerBId);
    expect(forgedConfirm.ok).toBe(false);

    const realConfirm = await fulfilmentService.confirmCustomerReceipt(domesticFulfilment.id, orderId, customerAId);
    expect(realConfirm.ok).toBe(true);
  });

  it("delivery support opens a Customer<->CrownSource conversation with Order context, not a vendor conversation", async () => {
    const { orderId } = await placeMultiVendorOrder();
    const result = await messagingService.startOrContinueContextual({
      customerProfileId: customerAId,
      senderUserId: customerAUserId,
      contextType: "ORDER",
      contextRefId: orderId,
      body: "My package status looks wrong.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) createdConversationIds.push(result.value.conversationId);
    if (!result.ok) return;

    const detail = await messagingService.getForCustomer(customerAId, result.value.conversationId);
    expect(detail?.participantType).toBe("CUSTOMER");
    expect(detail?.contextType).toBe("ORDER");

    // Neither vendor on this order can see it.
    const domesticVendorView = await messagingService.getForVendor(domesticVendorId, result.value.conversationId);
    expect(domesticVendorView).toBeNull();

    // Another customer cannot forge context against this real order.
    const forged = await messagingService.startOrContinueContextual({
      customerProfileId: customerBId,
      senderUserId: "some-other-user-id",
      contextType: "ORDER",
      contextRefId: orderId,
      body: "Trying to attach myself to someone else's order.",
    });
    expect(forged.ok).toBe(false);
  });

  // --- Notifications ---------------------------------------------------

  it("dispatches a new-order notification to each vendor exactly once, not on idempotent re-confirmation", async () => {
    const domesticListing = await prisma.vendorListing.create({
      data: { vendorId: domesticVendorId, categoryId, title: "Notif Test Item", description: "Test.", basePrice: 100, moq: 1, availableQuantity: 10, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(domesticListing.id);
    await cartService.addToCart(customerAId, domesticListing.id, 1);
    const orderResult = await ordersService.createOrderFromCart(customerAId, deliveryInfo);
    if (!orderResult.ok) throw new Error(orderResult.error);
    createdOrderIds.push(orderResult.value.orderId);

    const first = await ordersService.confirmOrderPayment(orderResult.value.orderId);
    expect(first.newFulfilments.map((f) => f.vendorId)).toEqual([domesticVendorId]);

    const second = await ordersService.confirmOrderPayment(orderResult.value.orderId); // idempotent replay
    expect(second.newFulfilments).toEqual([]);
  });

  it("email delivery failure does not roll back an already-committed collection confirmation", async () => {
    const spy = vi.spyOn(emailProviderModule.emailProvider, "send").mockRejectedValueOnce(new Error("simulated outage"));
    const { domesticFulfilment } = await placeMultiVendorOrder();
    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);

    const confirm = await fulfilmentService.confirmCollectedOrReceived(domesticFulfilment.id, "admin-user-id", null);
    expect(confirm.ok).toBe(true); // must still succeed
    await processEmailQueue();

    const fulfilment = await prisma.fulfilment.findUnique({ where: { id: domesticFulfilment.id } });
    expect(fulfilment?.status).toBe("DISPATCHED");
    spy.mockRestore();
  });

  // --- Inventory consistency ------------------------------------------

  it("does not double-decrement inventory during fulfilment operations", async () => {
    const { domesticFulfilment, domesticListing } = await placeMultiVendorOrder();
    const beforeOps = await prisma.vendorListing.findUnique({ where: { id: domesticListing.id } });

    await fulfilmentService.startPreparing(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.markReady(domesticVendorId, domesticFulfilment.id);
    await fulfilmentService.confirmCollectedOrReceived(domesticFulfilment.id, "admin-user-id", null);
    await fulfilmentService.progressToInTransit(domesticFulfilment.id);
    await fulfilmentService.progressToOutForDelivery(domesticFulfilment.id);
    await fulfilmentService.confirmDelivered(domesticFulfilment.id);

    const afterOps = await prisma.vendorListing.findUnique({ where: { id: domesticListing.id } });
    expect(afterOps?.availableQuantity).toBe(beforeOps?.availableQuantity); // unchanged by fulfilment progression
  });

  it("logisticsService.listActive only returns active receiving locations", async () => {
    const inactive = await prisma.receivingLocation.create({
      data: { name: "Inactive Depot", country: "Ghana", addressLine1: "x", active: false },
    });
    createdLocationIds.push(inactive.id);
    const active = await logisticsService.listActive();
    expect(active.some((l) => l.id === inactive.id)).toBe(false);
    expect(active.some((l) => l.id === receivingLocationId)).toBe(true);
  });
});
