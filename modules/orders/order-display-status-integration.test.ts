import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";

const { resolutionsService } = await import("../resolutions/service");
const { ordersService } = await import("./service");

/**
 * M11.1 corrective pass — root-causes and locks in the fix for issue #1: a
 * resolved/refunded Order kept showing "Delivered" to the customer. Goes
 * through the REAL admin workflow end-to-end (submitCase -> moveToUnderReview
 * -> approveResolution -> processRefund -> resolveCase), exactly like a
 * human admin using the UI, rather than fabricating an idealized DB state.
 */
describe("customer-facing derived Order status — real admin workflow (M11.1)", () => {
  const createdIds = { categories: [] as string[], vendors: [] as string[], listings: [] as string[], users: [] as string[], customerProfiles: [] as string[], orders: [] as string[] };

  afterAll(async () => {
    await prisma.resolutionCaseItem.deleteMany({ where: { orderItem: { orderId: { in: createdIds.orders } } } });
    await prisma.resolutionCaseActivity.deleteMany({ where: { resolutionCase: { orderId: { in: createdIds.orders } } } });
    await prisma.refund.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.resolutionCase.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.vendorFinancialAdjustment.deleteMany({ where: { vendorId: { in: createdIds.vendors } } });
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

  async function createDeliveredOrder() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "ODS Cat", slug: `ods-cat-${suffix}` } });
    createdIds.categories.push(category.id);
    const user = await prisma.user.create({ data: { id: `ods-customer-${suffix}`, name: "ODS Customer", email: `ods.${suffix}@example.com` } });
    createdIds.users.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "ODS Customer" } });
    createdIds.customerProfiles.push(customer.id);
    const vendor = await prisma.vendor.create({ data: { companyName: `ODS Vendor ${suffix}`, storefrontSlug: `ods-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdIds.vendors.push(vendor.id);
    const listing = await prisma.vendorListing.create({
      data: { title: "ODS Listing", description: "x", basePrice: 100, vendorId: vendor.id, categoryId: category.id, availableQuantity: 100, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdIds.listings.push(listing.id);
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-ODS-${suffix}`,
        customerProfileId: customer.id,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: 100,
        total: 100,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "ODS Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdIds.orders.push(order.id);
    const orderItem = await prisma.orderItem.create({
      data: { orderId: order.id, listingId: listing.id, vendorId: vendor.id, description: "ODS Listing", quantity: 1, unitPrice: 100, vendorPayableBasis: 70, lineTotal: 100 },
    });
    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId: vendor.id, origin: "DOMESTIC_COLLECTION", status: "DELIVERED" } });
    const fulfilmentItem = await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 1, unitPrice: 100, vendorPayableBasis: 70 } });
    await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id, status: "DELIVERED", deliveredAt: new Date() } });
    await prisma.vendorEarning.create({
      data: { vendorId: vendor.id, orderId: order.id, fulfilmentId: fulfilment.id, fulfilmentItemId: fulfilmentItem.id, orderItemId: orderItem.id, currency: "GHS", originalPayableAmount: 70, status: "ELIGIBLE" },
    });
    return { orderId: order.id, customerProfileId: customer.id, customerUserId: user.id, orderItemId: orderItem.id };
  }

  it("delivered -> case opened -> full refund approved -> refund COMPLETED shows REFUNDED, not DELIVERED", async () => {
    const { orderId, customerProfileId, customerUserId, orderItemId } = await createDeliveredOrder();

    expect((await ordersService.getOrderDetail(orderId, customerProfileId))?.displayStatus).toBe("DELIVERED");

    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: "ITEM_DAMAGED",
      description: "Arrived broken.",
      items: [{ orderItemId, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed: " + submitted.error);
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    expect((await ordersService.getOrderDetail(orderId, customerProfileId))?.displayStatus).toBe("ISSUE_UNDER_REVIEW");

    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 100 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved — full refund.",
    });
    expect((await ordersService.getOrderDetail(orderId, customerProfileId))?.displayStatus).toBe("REFUND_PROCESSING");

    const refund = await prisma.refund.findFirstOrThrow({ where: { orderId } });
    await resolutionsService.processRefund("staff-1", refund.id, "succeed", (await import("../refunds/mockExecutor")).mockRefundExecutor);

    const afterProcess = await ordersService.getOrderDetail(orderId, customerProfileId);
    expect(afterProcess?.displayStatus).toBe("REFUNDED");

    // Marking the case Resolved afterward must never regress the customer-facing status back toward "Delivered".
    await resolutionsService.resolveCase("staff-1", submitted.value.caseId);
    const afterResolve = await ordersService.getOrderDetail(orderId, customerProfileId);
    expect(afterResolve?.displayStatus).toBe("REFUNDED");

    // The customer order LIST must agree with the detail view.
    const list = await ordersService.listOrders(customerProfileId);
    expect(list.find((o) => o.id === orderId)?.displayStatus).toBe("REFUNDED");

    // Historical logistics facts are never rewritten.
    const shipment = await prisma.shipment.findFirstOrThrow({ where: { fulfilment: { orderId } } });
    expect(shipment.status).toBe("DELIVERED");
  });

  it("root-cause regression: a refund that fails to process (e.g. no automated refund API / no linked payment) and a case later marked Resolved must still show REFUND_PROCESSING, never the stale DELIVERED status", async () => {
    const { orderId, customerProfileId, customerUserId, orderItemId } = await createDeliveredOrder();

    const submitted = await resolutionsService.submitCase(customerProfileId, customerUserId, {
      orderId,
      issueType: "ITEM_DAMAGED",
      description: "Arrived broken.",
      items: [{ orderItemId, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed: " + submitted.error);
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 100 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved — full refund.",
    });

    const refund = await prisma.refund.findFirstOrThrow({ where: { orderId } });
    // Simulates the real-world failure path (moolreRefundExecutor always
    // fails closed; paystackRefundExecutor fails with no linked payment
    // reference) without depending on ambient env/provider configuration.
    const { moolreRefundExecutor } = await import("../refunds/moolreExecutor");
    await resolutionsService.processRefund("staff-1", refund.id, "succeed", moolreRefundExecutor);
    const failedRefund = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(failedRefund.status).toBe("FAILED");

    // The admin, believing the case is handled, marks it Resolved anyway.
    await resolutionsService.resolveCase("staff-1", submitted.value.caseId);

    const afterResolve = await ordersService.getOrderDetail(orderId, customerProfileId);
    expect(afterResolve?.displayStatus).not.toBe("DELIVERED");
    expect(afterResolve?.displayStatus).toBe("REFUND_PROCESSING");
  });

  it("multi-vendor: Vendor A delivered normally, Vendor B fully refunded — overall Order shows PARTIALLY_REFUNDED, Vendor A's package untouched", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "ODS MV Cat", slug: `ods-mv-cat-${suffix}` } });
    createdIds.categories.push(category.id);
    const user = await prisma.user.create({ data: { id: `ods-mv-customer-${suffix}`, name: "ODS MV Customer", email: `ods.mv.${suffix}@example.com` } });
    createdIds.users.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "ODS MV Customer" } });
    createdIds.customerProfiles.push(customer.id);
    const vendorA = await prisma.vendor.create({ data: { companyName: `ODS MV Vendor A ${suffix}`, storefrontSlug: `ods-mv-vendor-a-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    const vendorB = await prisma.vendor.create({ data: { companyName: `ODS MV Vendor B ${suffix}`, storefrontSlug: `ods-mv-vendor-b-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdIds.vendors.push(vendorA.id, vendorB.id);
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-ODS-MV-${suffix}`,
        customerProfileId: customer.id,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: 200,
        total: 200,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "ODS MV Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdIds.orders.push(order.id);

    async function makeDeliveredItem(vendorId: string, price: number) {
      const listing = await prisma.vendorListing.create({
        data: { title: "ODS MV Listing", description: "x", basePrice: price, vendorId, categoryId: category.id, availableQuantity: 100, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
      });
      createdIds.listings.push(listing.id);
      const orderItem = await prisma.orderItem.create({
        data: { orderId: order.id, listingId: listing.id, vendorId, description: "ODS MV Listing", quantity: 1, unitPrice: price, vendorPayableBasis: price * 0.7, lineTotal: price },
      });
      const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId, origin: "DOMESTIC_COLLECTION", status: "DELIVERED" } });
      const fulfilmentItem = await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 1, unitPrice: price, vendorPayableBasis: price * 0.7 } });
      await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id, status: "DELIVERED", deliveredAt: new Date() } });
      await prisma.vendorEarning.create({
        data: { vendorId, orderId: order.id, fulfilmentId: fulfilment.id, fulfilmentItemId: fulfilmentItem.id, orderItemId: orderItem.id, currency: "GHS", originalPayableAmount: price * 0.7, status: "ELIGIBLE" },
      });
      return orderItem.id;
    }

    const orderItemA = await makeDeliveredItem(vendorA.id, 100);
    const orderItemB = await makeDeliveredItem(vendorB.id, 100);

    const submitted = await resolutionsService.submitCase(customer.id, user.id, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "Vendor B's item arrived broken.",
      items: [{ orderItemId: orderItemB, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error("setup failed: " + submitted.error);
    await resolutionsService.moveToUnderReview("staff-1", submitted.value.caseId);
    const detail = await resolutionsService.getDetailForAdmin(submitted.value.caseId);
    await resolutionsService.approveResolution("staff-1", submitted.value.caseId, {
      items: [{ caseItemId: detail!.items[0]!.id, approvedResolution: "FULL_REFUND", approvedRefundAmount: 100 }],
      responsibility: "VENDOR",
      customerSafeDecisionReason: "Approved — full refund for Vendor B's item.",
    });

    const refund = await prisma.refund.findFirstOrThrow({ where: { orderId: order.id } });
    const { mockRefundExecutor } = await import("../refunds/mockExecutor");
    await resolutionsService.processRefund("staff-1", refund.id, "succeed", mockRefundExecutor);

    const view = await ordersService.getOrderDetail(order.id, customer.id);
    expect(view?.displayStatus).toBe("PARTIALLY_REFUNDED");
    const packageA = view?.packages.find((p) => p.vendorName === vendorA.companyName);
    const packageB = view?.packages.find((p) => p.vendorName === vendorB.companyName);
    expect(packageA?.status).toBe("DELIVERED"); // Vendor A's package is completely unaffected
    expect(packageB?.status).toBe("REFUNDED");

    const earningA = await prisma.vendorEarning.findFirstOrThrow({ where: { vendorId: vendorA.id, orderId: order.id } });
    expect(earningA.status).toBe("ELIGIBLE"); // Vendor A's earning untouched by Vendor B's refund
    const earningB = await prisma.vendorEarning.findFirstOrThrow({ where: { vendorId: vendorB.id, orderId: order.id } });
    expect(earningB.status).toBe("CANCELLED");
    void orderItemA;
  });
});
