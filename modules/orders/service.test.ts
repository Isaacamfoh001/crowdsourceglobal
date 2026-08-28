import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { ordersService } from "./service";
import type { DeliveryInfo } from "./types";

const deliveryInfo: DeliveryInfo = {
  recipientName: "Test Recipient",
  phone: "0244000000",
  addressLine1: "1 Test Street",
  city: "Accra",
  region: "Greater Accra",
};

/** Integration tests against the real local Postgres dev database. */
describe("ordersService", () => {
  let vendorAId: string;
  let vendorBId: string;
  let categoryId: string;
  let customerId: string;
  let userId: string;

  const createdOrderIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendorA = await prisma.vendor.create({
      data: { companyName: "Orders Test Vendor A", storefrontSlug: `orders-test-a-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorAId = vendorA.id;
    createdVendorIds.push(vendorA.id);
    const vendorB = await prisma.vendor.create({
      data: { companyName: "Orders Test Vendor B", storefrontSlug: `orders-test-b-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorBId = vendorB.id;
    createdVendorIds.push(vendorB.id);

    const category = await prisma.category.create({
      data: { name: "Orders Test Category", slug: `orders-test-category-${suffix}` },
    });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const user = await prisma.user.create({
      data: { id: `orders-test-user-${suffix}`, name: "Orders Test User", email: `orders.${suffix}@example.com` },
    });
    userId = user.id;
    createdUserIds.push(user.id);
    const customer = await prisma.customerProfile.create({
      data: { userId: user.id, displayName: "Orders Test User" },
    });
    customerId = customer.id;
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
    await prisma.vendorCostRule.deleteMany({ where: { listingId: { in: createdListingIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function seedCartWithListing(options: {
    vendorId: string;
    quantity: number;
    basePrice: number;
    availableQuantity: number;
    vendorSupplyCost?: number;
    approvalStatus?: "APPROVED" | "PENDING" | "CHANGES_REQUESTED";
    listingStatus?: "ACTIVE" | "INACTIVE" | "DRAFT";
    pendingChanges?: object;
  }) {
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId: options.vendorId,
        categoryId,
        title: "Orders Test Listing",
        description: "Fixture.",
        basePrice: options.basePrice,
        moq: 1,
        availableQuantity: options.availableQuantity,
        approvalStatus: options.approvalStatus ?? "APPROVED",
        listingStatus: options.listingStatus ?? "ACTIVE",
        pendingChanges: options.pendingChanges,
      },
    });
    createdListingIds.push(listing.id);

    if (options.vendorSupplyCost !== undefined) {
      await prisma.vendorCostRule.create({
        data: {
          listingId: listing.id,
          vendorSupplyCost: options.vendorSupplyCost,
          marginRuleType: "PERCENTAGE",
          marginValue: 30,
        },
      });
    }

    const cart = await prisma.cart.create({ data: { customerProfileId: customerId } });
    await prisma.cartItem.create({
      data: { cartId: cart.id, listingId: listing.id, quantity: options.quantity },
    });

    return listing;
  }

  it("creates a PENDING_PAYMENT order with an authoritative server-computed total", async () => {
    await seedCartWithListing({ vendorId: vendorAId, quantity: 3, basePrice: 25, availableQuantity: 50 });

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdOrderIds.push(result.value.orderId);

    const order = await prisma.order.findUnique({ where: { id: result.value.orderId } });
    expect(order?.status).toBe("PENDING_PAYMENT");
    expect(order?.paymentStatus).toBe("UNPAID");
    expect(order?.total.toNumber()).toBe(75); // 3 x 25 — computed server-side, not client-submitted
  });

  it("atomically decrements listing availability on order creation", async () => {
    const listing = await seedCartWithListing({ vendorId: vendorAId, quantity: 5, basePrice: 10, availableQuantity: 20 });

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(true);
    if (result.ok) createdOrderIds.push(result.value.orderId);

    const updated = await prisma.vendorListing.findUnique({ where: { id: listing.id } });
    expect(updated?.availableQuantity).toBe(15); // 20 - 5
  });

  it("rejects checkout when requested quantity exceeds available stock", async () => {
    await seedCartWithListing({ vendorId: vendorAId, quantity: 10, basePrice: 10, availableQuantity: 3 });

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(false);
  });

  // --- M21.2: checkout eligibility/pricing during a staged edit re-review ---

  it("checks out normally, at the live price, while the listing has a staged edit under PENDING re-review", async () => {
    await seedCartWithListing({
      vendorId: vendorAId,
      quantity: 2,
      basePrice: 30,
      availableQuantity: 20,
      approvalStatus: "PENDING",
      pendingChanges: { listing: { basePrice: 9999 }, bulkPriceTiers: [] },
    });

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdOrderIds.push(result.value.orderId);

    const orderItem = await prisma.orderItem.findFirst({ where: { orderId: result.value.orderId } });
    expect(orderItem?.unitPrice.toNumber()).toBe(30); // live price, never the pending 9999
  });

  it("checks out normally while the listing's edit is under CHANGES_REQUESTED re-review", async () => {
    await seedCartWithListing({
      vendorId: vendorAId,
      quantity: 1,
      basePrice: 50,
      availableQuantity: 10,
      approvalStatus: "CHANGES_REQUESTED",
    });

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(true);
    if (result.ok) createdOrderIds.push(result.value.orderId);
  });

  it("still rejects checkout for a never-approved (DRAFT) listing", async () => {
    await seedCartWithListing({
      vendorId: vendorAId,
      quantity: 1,
      basePrice: 50,
      availableQuantity: 10,
      approvalStatus: "PENDING",
      listingStatus: "DRAFT",
    });

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(false);
  });

  it("snapshots OrderItem economics immutably against later listing changes", async () => {
    const listing = await seedCartWithListing({
      vendorId: vendorAId,
      quantity: 2,
      basePrice: 100,
      availableQuantity: 20,
      vendorSupplyCost: 60,
    });

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdOrderIds.push(result.value.orderId);

    const orderItem = await prisma.orderItem.findFirst({ where: { orderId: result.value.orderId } });
    expect(orderItem?.unitPrice.toNumber()).toBe(100);
    expect(orderItem?.vendorPayableBasis.toNumber()).toBe(120); // 60 x 2

    // Change the listing's price and vendor cost AFTER the order exists.
    await prisma.vendorListing.update({ where: { id: listing.id }, data: { basePrice: 999 } });
    await prisma.vendorCostRule.update({ where: { listingId: listing.id }, data: { vendorSupplyCost: 5 } });

    const orderItemAfter = await prisma.orderItem.findFirst({ where: { orderId: result.value.orderId } });
    expect(orderItemAfter?.unitPrice.toNumber()).toBe(100); // unchanged
    expect(orderItemAfter?.vendorPayableBasis.toNumber()).toBe(120); // unchanged
  });

  it("fans out one Fulfilment per distinct vendor on payment confirmation", async () => {
    await seedCartWithListing({ vendorId: vendorAId, quantity: 1, basePrice: 40, availableQuantity: 10 });
    // A second cart item from a different vendor, same cart lookup (cartService adds to the
    // customer's single active cart — here we simulate that directly).
    const listingB = await prisma.vendorListing.create({
      data: {
        vendorId: vendorBId,
        categoryId,
        title: "Orders Test Listing B",
        description: "Fixture.",
        basePrice: 15,
        moq: 1,
        availableQuantity: 10,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });
    createdListingIds.push(listingB.id);

    const activeCart = await prisma.cart.findFirst({ where: { customerProfileId: customerId, status: "ACTIVE" } });
    await prisma.cartItem.create({ data: { cartId: activeCart!.id, listingId: listingB.id, quantity: 2 } });

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdOrderIds.push(result.value.orderId);

    await ordersService.confirmOrderPayment(result.value.orderId);

    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId: result.value.orderId } });
    expect(fulfilments.length).toBe(2);
    expect(fulfilments.map((f) => f.vendorId).sort()).toEqual([vendorAId, vendorBId].sort());

    const order = await prisma.order.findUnique({ where: { id: result.value.orderId } });
    expect(order?.status).toBe("CONFIRMED");
    expect(order?.paymentStatus).toBe("PAID");
    expect(order?.fulfilmentsCreatedAt).not.toBeNull();
  });

  it("is idempotent — confirming an already-confirmed order does not duplicate Fulfilments", async () => {
    await seedCartWithListing({ vendorId: vendorAId, quantity: 1, basePrice: 40, availableQuantity: 10 });
    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdOrderIds.push(result.value.orderId);

    await ordersService.confirmOrderPayment(result.value.orderId);
    await ordersService.confirmOrderPayment(result.value.orderId); // second call — must be a no-op

    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId: result.value.orderId } });
    expect(fulfilments.length).toBe(1);
  });

  it("never exposes vendor cost/margin fields on the customer-facing order detail view", async () => {
    await seedCartWithListing({
      vendorId: vendorAId,
      quantity: 1,
      basePrice: 40,
      availableQuantity: 10,
      vendorSupplyCost: 22,
    });
    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdOrderIds.push(result.value.orderId);

    const detail = await ordersService.getOrderDetail(result.value.orderId, customerId);
    expect(detail).not.toBeNull();

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("vendorPayableBasis");
    expect(serialized).not.toContain("vendorSupplyCost");
    expect(serialized).not.toContain("marginValue");
  });
});
