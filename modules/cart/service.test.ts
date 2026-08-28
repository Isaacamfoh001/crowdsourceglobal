import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { cartService } from "./service";

/** Integration tests against the real local Postgres dev database (M1/M2 pattern). */
describe("cartService", () => {
  let vendorId: string;
  let categoryId: string;
  let customerAId: string;
  let customerBId: string;
  let userAId: string;
  let userBId: string;

  let normalListingId: string;
  let moqListingId: string;
  let outOfStockListingId: string;
  let inactiveListingId: string;
  let lowStockListingId: string;
  let underReviewListingId: string;
  let neverApprovedListingId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    const vendor = await prisma.vendor.create({
      data: {
        companyName: "Cart Test Vendor",
        storefrontSlug: `cart-test-vendor-${suffix}`,
        verificationStatus: "APPROVED",
      },
    });
    vendorId = vendor.id;

    const category = await prisma.category.create({
      data: { name: "Cart Test Category", slug: `cart-test-category-${suffix}` },
    });
    categoryId = category.id;

    const userA = await prisma.user.create({
      data: { id: `cart-test-user-a-${suffix}`, name: "Cart Test A", email: `cart.a.${suffix}@example.com` },
    });
    userAId = userA.id;
    const customerA = await prisma.customerProfile.create({
      data: { userId: userA.id, displayName: "Cart Test A" },
    });
    customerAId = customerA.id;

    const userB = await prisma.user.create({
      data: { id: `cart-test-user-b-${suffix}`, name: "Cart Test B", email: `cart.b.${suffix}@example.com` },
    });
    userBId = userB.id;
    const customerB = await prisma.customerProfile.create({
      data: { userId: userB.id, displayName: "Cart Test B" },
    });
    customerBId = customerB.id;

    const commonListingData = {
      vendorId,
      categoryId,
      description: "Fixture listing for cart tests.",
      basePrice: 50,
      approvalStatus: "APPROVED" as const,
      listingStatus: "ACTIVE" as const,
    };

    const normal = await prisma.vendorListing.create({
      data: { ...commonListingData, title: "Normal Listing", moq: 1, availableQuantity: 100 },
    });
    normalListingId = normal.id;

    const moqListing = await prisma.vendorListing.create({
      data: { ...commonListingData, title: "High-MOQ Listing", moq: 10, availableQuantity: 200 },
    });
    moqListingId = moqListing.id;

    const outOfStock = await prisma.vendorListing.create({
      data: {
        ...commonListingData,
        title: "Out Of Stock Listing",
        moq: 1,
        availableQuantity: 0,
        availabilityStatus: "OUT_OF_STOCK",
      },
    });
    outOfStockListingId = outOfStock.id;

    const inactive = await prisma.vendorListing.create({
      data: {
        ...commonListingData,
        title: "Inactive Listing",
        moq: 1,
        availableQuantity: 50,
        listingStatus: "INACTIVE",
      },
    });
    inactiveListingId = inactive.id;

    const lowStock = await prisma.vendorListing.create({
      data: { ...commonListingData, title: "Low Stock Listing", moq: 1, availableQuantity: 3 },
    });
    lowStockListingId = lowStock.id;

    // M21.2 — live listing with a staged edit under re-review: approvalStatus
    // moved off APPROVED, listingStatus stays ACTIVE.
    const underReview = await prisma.vendorListing.create({
      data: {
        ...commonListingData,
        title: "Live Listing Under Re-Review",
        moq: 1,
        availableQuantity: 40,
        approvalStatus: "PENDING",
        pendingChanges: { listing: { basePrice: 9999 }, bulkPriceTiers: [] },
      },
    });
    underReviewListingId = underReview.id;

    const neverApproved = await prisma.vendorListing.create({
      data: {
        ...commonListingData,
        title: "Never Approved Listing",
        moq: 1,
        availableQuantity: 40,
        approvalStatus: "PENDING",
        listingStatus: "DRAFT",
      },
    });
    neverApprovedListingId = neverApproved.id;
  });

  afterAll(async () => {
    await prisma.cartItem.deleteMany({ where: { cart: { customerProfileId: { in: [customerAId, customerBId] } } } });
    await prisma.cart.deleteMany({ where: { customerProfileId: { in: [customerAId, customerBId] } } });
    await prisma.vendorListing.deleteMany({ where: { vendorId } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: [customerAId, customerBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.vendor.delete({ where: { id: vendorId } });
    await prisma.$disconnect();
  });

  it("adds a listing to the cart", async () => {
    const result = await cartService.addToCart(customerAId, normalListingId, 2);
    expect(result.ok).toBe(true);

    const view = await cartService.getCartView(customerAId);
    const line = view.vendorGroups.flatMap((g) => g.lines).find((l) => l.listingId === normalListingId);
    expect(line?.quantity).toBe(2);
  });

  it("accumulates quantity when adding the same listing again", async () => {
    await cartService.addToCart(customerAId, normalListingId, 3);
    const view = await cartService.getCartView(customerAId);
    const line = view.vendorGroups.flatMap((g) => g.lines).find((l) => l.listingId === normalListingId);
    expect(line?.quantity).toBe(5); // 2 + 3
  });

  it("rejects a quantity below MOQ", async () => {
    const result = await cartService.addToCart(customerAId, moqListingId, 3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Minimum order quantity");
  });

  it("rejects an out-of-stock listing", async () => {
    const result = await cartService.addToCart(customerAId, outOfStockListingId, 1);
    expect(result.ok).toBe(false);
  });

  it("rejects an inactive (unapproved-for-purchase) listing", async () => {
    const result = await cartService.addToCart(customerAId, inactiveListingId, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("no longer available");
  });

  it("M21.2: allows adding a live listing whose edit is under PENDING re-review, at its live (unchanged) price", async () => {
    const result = await cartService.addToCart(customerAId, underReviewListingId, 1);
    expect(result.ok).toBe(true);

    const view = await cartService.getCartView(customerAId);
    const line = view.vendorGroups.flatMap((g) => g.lines).find((l) => l.listingId === underReviewListingId);
    expect(line?.unitPrice).toBe(50); // commonListingData.basePrice — never the pending 9999
  });

  it("M21.2: still rejects a never-approved (DRAFT) listing", async () => {
    const result = await cartService.addToCart(customerAId, neverApprovedListingId, 1);
    expect(result.ok).toBe(false);
  });

  it("rejects a quantity exceeding available stock", async () => {
    const result = await cartService.addToCart(customerAId, lowStockListingId, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Only 3");
  });

  it("enforces cart ownership on quantity updates", async () => {
    const view = await cartService.getCartView(customerAId);
    const line = view.vendorGroups.flatMap((g) => g.lines).find((l) => l.listingId === normalListingId);
    expect(line).toBeDefined();

    // Customer B attempts to modify Customer A's cart item.
    const result = await cartService.updateQuantity(customerBId, line!.id, 99);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not found");

    // Confirm it was NOT changed.
    const unchanged = await cartService.getCartView(customerAId);
    const unchangedLine = unchanged.vendorGroups
      .flatMap((g) => g.lines)
      .find((l) => l.listingId === normalListingId);
    expect(unchangedLine?.quantity).toBe(5);
  });

  it("removes an item from the cart", async () => {
    const view = await cartService.getCartView(customerAId);
    const line = view.vendorGroups.flatMap((g) => g.lines).find((l) => l.listingId === normalListingId);
    const result = await cartService.removeItem(customerAId, line!.id);
    expect(result.ok).toBe(true);

    const after = await cartService.getCartView(customerAId);
    expect(after.vendorGroups.flatMap((g) => g.lines).find((l) => l.listingId === normalListingId)).toBeUndefined();
  });

  it("groups items from different vendors separately in the cart view", async () => {
    const secondVendor = await prisma.vendor.create({
      data: {
        companyName: "Second Cart Test Vendor",
        storefrontSlug: `cart-test-vendor-2-${Date.now()}`,
        verificationStatus: "APPROVED",
      },
    });
    const secondListing = await prisma.vendorListing.create({
      data: {
        vendorId: secondVendor.id,
        categoryId,
        title: "Second Vendor Listing",
        description: "Fixture.",
        basePrice: 20,
        moq: 1,
        availableQuantity: 50,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });

    await cartService.addToCart(customerAId, moqListingId, 10); // vendor 1
    await cartService.addToCart(customerAId, secondListing.id, 1); // vendor 2

    const view = await cartService.getCartView(customerAId);
    expect(view.vendorGroups.length).toBe(2);
    const vendorIds = view.vendorGroups.map((g) => g.vendor.id).sort();
    expect(vendorIds).toEqual([vendorId, secondVendor.id].sort());

    await prisma.cartItem.deleteMany({ where: { listingId: secondListing.id } });
    await prisma.vendorListing.delete({ where: { id: secondListing.id } });
    await prisma.vendor.delete({ where: { id: secondVendor.id } });
  });
});
