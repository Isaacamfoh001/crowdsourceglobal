import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/db";
import { ordersService } from "../orders/service";
import type { DeliveryInfo } from "../orders/types";
import { paymentsService } from "./service";

const deliveryInfo: DeliveryInfo = {
  recipientName: "Test Recipient",
  phone: "0244000000",
  addressLine1: "1 Test Street",
  city: "Accra",
  region: "Greater Accra",
};

/** Integration tests against the real local Postgres dev database. */
describe("paymentsService", () => {
  let vendorId: string;
  let categoryId: string;
  let customerId: string;
  let otherCustomerId: string;
  let userId: string;
  let otherUserId: string;

  const createdOrderIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendor = await prisma.vendor.create({
      data: { companyName: "Payments Test Vendor", storefrontSlug: `payments-test-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorId = vendor.id;
    createdVendorIds.push(vendor.id);

    const category = await prisma.category.create({
      data: { name: "Payments Test Category", slug: `payments-test-category-${suffix}` },
    });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const user = await prisma.user.create({
      data: { id: `payments-test-user-${suffix}`, name: "Payments Test User", email: `payments.${suffix}@example.com` },
    });
    userId = user.id;
    createdUserIds.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "Payments Test User" } });
    customerId = customer.id;
    createdCustomerIds.push(customer.id);

    const otherUser = await prisma.user.create({
      data: { id: `payments-test-other-${suffix}`, name: "Other User", email: `payments.other.${suffix}@example.com` },
    });
    otherUserId = otherUser.id;
    createdUserIds.push(otherUser.id);
    const otherCustomer = await prisma.customerProfile.create({ data: { userId: otherUser.id, displayName: "Other User" } });
    otherCustomerId = otherCustomer.id;
    createdCustomerIds.push(otherCustomer.id);
  });

  afterAll(async () => {
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.idempotencyKey.deleteMany({ where: { resultRef: { in: await paymentIdsFor(createdOrderIds) } } });
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

  async function paymentIdsFor(orderIds: string[]) {
    if (orderIds.length === 0) return [];
    const payments = await prisma.payment.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
    return payments.map((p) => p.id);
  }

  async function createPendingOrder(basePrice = 50, quantity = 1) {
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Payments Test Listing",
        description: "Fixture.",
        basePrice,
        moq: 1,
        availableQuantity: 20,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });
    createdListingIds.push(listing.id);

    const cart = await prisma.cart.create({ data: { customerProfileId: customerId } });
    await prisma.cartItem.create({ data: { cartId: cart.id, listingId: listing.id, quantity } });

    const result = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    if (!result.ok) throw new Error(result.error);
    createdOrderIds.push(result.value.orderId);
    return result.value.orderId;
  }

  it("confirms the order and creates fulfilments on a successful mock payment", async () => {
    const orderId = await createPendingOrder();

    const result = await paymentsService.attemptMockPayment({
      customerProfileId: customerId,
      orderId,
      outcome: "succeed",
      idempotencyKey: randomUUID(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.succeeded).toBe(true);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CONFIRMED");
    expect(order?.paymentStatus).toBe("PAID");

    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(1);

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment?.status).toBe("SUCCEEDED");
  });

  it("leaves the order in PENDING_PAYMENT on a failed mock payment, with no fulfilments created", async () => {
    const orderId = await createPendingOrder();

    const result = await paymentsService.attemptMockPayment({
      customerProfileId: customerId,
      orderId,
      outcome: "fail",
      idempotencyKey: randomUUID(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.succeeded).toBe(false);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("PENDING_PAYMENT");
    expect(order?.paymentStatus).toBe("UNPAID");

    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(0);

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment?.status).toBe("FAILED");
  });

  it("allows a retry after a failed payment to succeed", async () => {
    const orderId = await createPendingOrder();

    await paymentsService.attemptMockPayment({
      customerProfileId: customerId,
      orderId,
      outcome: "fail",
      idempotencyKey: randomUUID(),
    });

    const retry = await paymentsService.attemptMockPayment({
      customerProfileId: customerId,
      orderId,
      outcome: "succeed",
      idempotencyKey: randomUUID(), // fresh key — new page render
    });

    expect(retry.ok).toBe(true);
    if (retry.ok) expect(retry.value.succeeded).toBe(true);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CONFIRMED");

    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(2); // one failed record, one succeeded record
  });

  it("is idempotent on duplicate submission — same key does not create a second Payment or double-confirm", async () => {
    const orderId = await createPendingOrder();
    const idempotencyKey = randomUUID();

    const [first, second] = await Promise.all([
      paymentsService.attemptMockPayment({ customerProfileId: customerId, orderId, outcome: "succeed", idempotencyKey }),
      paymentsService.attemptMockPayment({ customerProfileId: customerId, orderId, outcome: "succeed", idempotencyKey }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.succeeded).toBe(second.value.succeeded);
    }

    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(1);

    const fulfilments = await prisma.fulfilment.findMany({ where: { orderId } });
    expect(fulfilments.length).toBe(1);
  });

  it("a sequential duplicate submission with the same key returns the already-recorded result without reprocessing", async () => {
    const orderId = await createPendingOrder();
    const idempotencyKey = randomUUID();

    const first = await paymentsService.attemptMockPayment({
      customerProfileId: customerId,
      orderId,
      outcome: "succeed",
      idempotencyKey,
    });
    // Second submission uses the same key but a different requested outcome —
    // it must return the FIRST result, not reprocess as a failure.
    const second = await paymentsService.attemptMockPayment({
      customerProfileId: customerId,
      orderId,
      outcome: "fail",
      idempotencyKey,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.succeeded).toBe(first.value.succeeded);
      expect(second.value.succeeded).toBe(true);
    }

    const payments = await prisma.payment.findMany({ where: { orderId } });
    expect(payments.length).toBe(1);
  });

  it("rejects a payment attempt for an order owned by a different customer", async () => {
    const orderId = await createPendingOrder();

    const result = await paymentsService.attemptMockPayment({
      customerProfileId: otherCustomerId,
      orderId,
      outcome: "succeed",
      idempotencyKey: randomUUID(),
    });

    expect(result.ok).toBe(false);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("PENDING_PAYMENT");
  });
});
