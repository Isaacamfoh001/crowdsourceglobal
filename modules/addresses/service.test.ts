import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { addressesService } from "./service";
import { ordersService } from "../orders/service";
import type { DeliveryInfo } from "../orders/types";

/** Integration tests against the real local Postgres dev database. */
describe("addressesService", () => {
  let customerAId: string;
  let customerBId: string;
  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];

  const sampleAddress = {
    label: "Home",
    recipientName: "Isaac Amfoh",
    phone: "0244123456",
    addressLine1: "12 East Legon Road",
    addressLine2: "",
    city: "Accra",
    region: "Greater Accra",
  };

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userA = await prisma.user.create({ data: { id: `addr-user-a-${suffix}`, name: "Address User A", email: `addr.a.${suffix}@example.com` } });
    createdUserIds.push(userA.id);
    const customerA = await prisma.customerProfile.create({ data: { userId: userA.id, displayName: "Address User A" } });
    customerAId = customerA.id;
    createdCustomerIds.push(customerA.id);

    const userB = await prisma.user.create({ data: { id: `addr-user-b-${suffix}`, name: "Address User B", email: `addr.b.${suffix}@example.com` } });
    createdUserIds.push(userB.id);
    const customerB = await prisma.customerProfile.create({ data: { userId: userB.id, displayName: "Address User B" } });
    customerBId = customerB.id;
    createdCustomerIds.push(customerB.id);
  });

  afterAll(async () => {
    await prisma.customerAddress.deleteMany({ where: { customerProfileId: { in: createdCustomerIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it("creates an address for the customer", async () => {
    const result = await addressesService.create(customerAId, sampleAddress);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.recipientName).toBe(sampleAddress.recipientName);
  });

  it("the first address created automatically becomes the default", async () => {
    const result = await addressesService.create(customerAId, sampleAddress);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isDefault).toBe(true);
  });

  it("a second address is not automatically default", async () => {
    await addressesService.create(customerAId, sampleAddress);
    const second = await addressesService.create(customerAId, { ...sampleAddress, label: "Office" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.isDefault).toBe(false);
  });

  it("setDefault switches the default — at most one default at a time", async () => {
    const first = await addressesService.create(customerAId, sampleAddress);
    const second = await addressesService.create(customerAId, { ...sampleAddress, label: "Office" });
    if (!first.ok || !second.ok) throw new Error("setup failed");

    await addressesService.setDefault(customerAId, second.value.id);

    const list = await addressesService.listForCustomer(customerAId);
    const defaults = list.filter((a) => a.isDefault);
    expect(defaults.length).toBe(1);
    expect(defaults[0]?.id).toBe(second.value.id);
  });

  it("deleting the default address promotes another as the new default", async () => {
    const first = await addressesService.create(customerAId, sampleAddress);
    const second = await addressesService.create(customerAId, { ...sampleAddress, label: "Office" });
    if (!first.ok || !second.ok) throw new Error("setup failed");

    await addressesService.remove(customerAId, first.value.id);

    const list = await addressesService.listForCustomer(customerAId);
    expect(list.length).toBe(1);
    expect(list[0]?.isDefault).toBe(true);
  });

  it("Customer A cannot read, update, delete, or set-default Customer B's address (IDOR)", async () => {
    const created = await addressesService.create(customerBId, sampleAddress);
    if (!created.ok) throw new Error("setup failed");

    expect(await addressesService.getForCheckout(customerAId, created.value.id)).toBeNull();

    const updateResult = await addressesService.update(customerAId, created.value.id, { ...sampleAddress, recipientName: "Attacker" });
    expect(updateResult.ok).toBe(false);

    const deleteResult = await addressesService.remove(customerAId, created.value.id);
    expect(deleteResult.ok).toBe(false);

    const defaultResult = await addressesService.setDefault(customerAId, created.value.id);
    expect(defaultResult.ok).toBe(false);

    // Untouched — B's address survives every A-attempted mutation.
    const stillThere = await addressesService.getForCheckout(customerBId, created.value.id);
    expect(stillThere?.recipientName).toBe(sampleAddress.recipientName);
  });

  it("rejects an address with an invalid region", async () => {
    const result = await addressesService.create(customerAId, { ...sampleAddress, region: "Not A Real Region" });
    expect(result.ok).toBe(false);
  });

  it("rejects an address with a too-short delivery line", async () => {
    const result = await addressesService.create(customerAId, { ...sampleAddress, addressLine1: "x" });
    expect(result.ok).toBe(false);
  });
});

describe("addressesService — Order snapshot immutability (M10 hardening)", () => {
  let categoryId: string;
  let vendorId: string;
  let customerId: string;
  const createdIds = { categories: [] as string[], vendors: [] as string[], listings: [] as string[], users: [] as string[], customerProfiles: [] as string[], orders: [] as string[] };

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "Snapshot Test Category", slug: `snapshot-cat-${suffix}` } });
    categoryId = category.id;
    createdIds.categories.push(category.id);
    const vendor = await prisma.vendor.create({ data: { companyName: `Snapshot Vendor ${suffix}`, storefrontSlug: `snapshot-vendor-${suffix}`, verificationStatus: "APPROVED" } });
    vendorId = vendor.id;
    createdIds.vendors.push(vendor.id);
    const user = await prisma.user.create({ data: { id: `snapshot-user-${suffix}`, name: "Snapshot User", email: `snapshot.${suffix}@example.com` } });
    createdIds.users.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "Snapshot User" } });
    customerId = customer.id;
    createdIds.customerProfiles.push(customer.id);
  });

  afterAll(async () => {
    await prisma.customerAddress.deleteMany({ where: { customerProfileId: { in: createdIds.customerProfiles } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: createdIds.orders } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdIds.listings } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdIds.customerProfiles } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdIds.vendors } } });
    await prisma.category.deleteMany({ where: { id: { in: createdIds.categories } } });
    await prisma.$disconnect();
  });

  it("an Order snapshots the selected address's values at checkout, and later edits to the saved address never change the Order", async () => {
    const created = await addressesService.create(customerId, {
      label: "Home",
      recipientName: "Isaac Amfoh",
      phone: "0244123456",
      addressLine1: "East Legon",
      addressLine2: "",
      city: "Accra",
      region: "Greater Accra",
    });
    if (!created.ok) throw new Error("setup failed");

    const listing = await prisma.vendorListing.create({
      data: { vendorId, categoryId, title: "Snapshot Listing", description: "Fixture.", basePrice: 20, moq: 1, availableQuantity: 10, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdIds.listings.push(listing.id);
    const cart = await prisma.cart.create({ data: { customerProfileId: customerId } });
    await prisma.cartItem.create({ data: { cartId: cart.id, listingId: listing.id, quantity: 1 } });

    // Simulates the UI submitting the saved address's CURRENT values as the
    // plain DeliveryInfo object — exactly what DeliveryAddressFields'
    // hidden inputs produce.
    const deliveryInfo: DeliveryInfo = {
      recipientName: created.value.recipientName,
      phone: created.value.phone,
      addressLine1: created.value.addressLine1,
      city: created.value.city,
      region: created.value.region,
    };
    const orderResult = await ordersService.createOrderFromCart(customerId, deliveryInfo);
    if (!orderResult.ok) throw new Error(orderResult.error);
    createdIds.orders.push(orderResult.value.orderId);

    // Now edit the saved address to a different address entirely.
    await addressesService.update(customerId, created.value.id, {
      label: "Home",
      recipientName: "Isaac Amfoh",
      phone: "0244123456",
      addressLine1: "Airport Residential Area",
      addressLine2: "",
      city: "Accra",
      region: "Greater Accra",
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderResult.value.orderId } });
    const snapshot = order.deliveryInfo as unknown as DeliveryInfo;
    expect(snapshot.addressLine1).toBe("East Legon"); // the OLD value — never reads the current CustomerAddress
    expect(snapshot.addressLine1).not.toBe("Airport Residential Area");
  });
});
