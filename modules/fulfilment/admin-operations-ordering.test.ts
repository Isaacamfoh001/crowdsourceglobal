import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { fulfilmentService } from "./service";

/**
 * M11.1 corrective pass — issue #3: the admin Operations queue was
 * oldest-first (a deliberate decision from the original pagination rollout
 * that real-world admin testing overturned). A newly created Fulfilment
 * must appear on page 1, not buried on the last page. Ordering must happen
 * at the DB query level before pagination, never fetched-then-reversed.
 */
describe("fulfilmentService.listForAdminPaginated — newest-first ordering (M11.1)", () => {
  const createdIds = { orders: [] as string[], vendors: [] as string[], listings: [] as string[], customerProfiles: [] as string[], users: [] as string[], categories: [] as string[] };

  afterAll(async () => {
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

  it("page 1 shows the newest records; a fulfilment created just now appears on page 1, not the last page", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "Ops Order Cat", slug: `ops-order-cat-${suffix}` } });
    createdIds.categories.push(category.id);
    const user = await prisma.user.create({ data: { id: `ops-order-customer-${suffix}`, name: "Ops Order Customer", email: `ops.order.${suffix}@example.com` } });
    createdIds.users.push(user.id);
    const customer = await prisma.customerProfile.create({ data: { userId: user.id, displayName: "Ops Order Customer" } });
    createdIds.customerProfiles.push(customer.id);
    const vendor = await prisma.vendor.create({ data: { companyName: `Ops Order Vendor ${suffix}`, storefrontSlug: `ops-order-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdIds.vendors.push(vendor.id);
    const listing = await prisma.vendorListing.create({
      data: { title: "Ops Order Listing", description: "x", basePrice: 10, vendorId: vendor.id, categoryId: category.id, availableQuantity: 1000, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdIds.listings.push(listing.id);

    // 25 fulfilments, oldest to newest, so a page size of 20 spans exactly 2 pages.
    // Timestamped a year in the future so this fixture set is guaranteed to
    // sort strictly above anything else in the (shared, real-Postgres) test
    // database — including rows other integration test files create
    // concurrently at real "now" — without depending on the DB being empty.
    const baseTime = Date.now() + 1000 * 60 * 60 * 24 * 365;
    const createdFulfilmentIds: string[] = [];
    for (let i = 0; i < 25; i += 1) {
      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-OPS-ORDER-${suffix}-${i}`,
          customerProfileId: customer.id,
          status: "CONFIRMED",
          paymentStatus: "PAID",
          subtotal: 10,
          total: 10,
          fulfilmentsCreatedAt: new Date(baseTime + i * 1000),
          deliveryInfo: { recipientName: "Ops Order Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
        },
      });
      createdIds.orders.push(order.id);
      const orderItem = await prisma.orderItem.create({
        data: { orderId: order.id, listingId: listing.id, vendorId: vendor.id, description: "Ops Order Listing", quantity: 1, unitPrice: 10, vendorPayableBasis: 7, lineTotal: 10 },
      });
      const fulfilment = await prisma.fulfilment.create({
        data: { orderId: order.id, vendorId: vendor.id, origin: "DOMESTIC_COLLECTION", createdAt: new Date(baseTime + i * 1000) },
      });
      await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 1, unitPrice: 10, vendorPayableBasis: 7 } });
      createdFulfilmentIds.push(fulfilment.id);
    }
    // createdFulfilmentIds[24] is the newest (i = 24), createdFulfilmentIds[0] the oldest.

    const page1 = await fulfilmentService.listForAdminPaginated({}, 1);
    const ourPage1Ids = page1.rows.filter((r) => createdFulfilmentIds.includes(r.id)).map((r) => r.id);
    // All of our 25 fixtures are newer than anything else the DB might already hold (offset a day back but sequential), so the first 20 of our set land on page 1, in newest-first order.
    expect(ourPage1Ids[0]).toBe(createdFulfilmentIds[24]); // newest first
    expect(ourPage1Ids.length).toBeGreaterThanOrEqual(20);

    // Confirm strict newest-first ordering across our fixture set specifically (filtered from page 1 + page 2).
    const page2 = await fulfilmentService.listForAdminPaginated({}, 2);
    const combined = [...page1.rows, ...page2.rows].filter((r) => createdFulfilmentIds.includes(r.id));
    const idsInOrder = combined.map((r) => r.id);
    const expectedNewestFirst = [...createdFulfilmentIds].reverse();
    expect(idsInOrder).toEqual(expectedNewestFirst);
  });
});
