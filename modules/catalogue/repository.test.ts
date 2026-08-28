import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { catalogueRepository } from "./repository";

/**
 * Integration tests against the real local Postgres dev database (see
 * docs/architecture/overview.md — no separate test DB/container for M1).
 * Assumes `npm run prisma:seed` has been run. Creates and tears down its
 * own throwaway rows for the visibility-filter test rather than depending
 * on seed data staying a particular shape.
 */
describe("catalogueRepository", () => {
  let vendorId: string;
  let categoryId: string;
  let hiddenListingId: string;

  beforeAll(async () => {
    const vendor = await prisma.vendor.create({
      data: {
        companyName: "Test Fixture Vendor",
        storefrontSlug: `test-fixture-vendor-${Date.now()}`,
        verificationStatus: "APPROVED",
      },
    });
    vendorId = vendor.id;

    const category = await prisma.category.create({
      data: { name: "Test Fixture Category", slug: `test-fixture-category-${Date.now()}` },
    });
    categoryId = category.id;

    // A listing that must NEVER appear in public queries.
    const hidden = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Unapproved Draft Listing",
        description: "Should never be publicly visible.",
        basePrice: 100,
        approvalStatus: "PENDING",
        listingStatus: "DRAFT",
      },
    });
    hiddenListingId = hidden.id;

    await prisma.vendorCostRule.create({
      data: {
        listingId: hidden.id,
        vendorSupplyCost: 60,
        marginRuleType: "PERCENTAGE",
        marginValue: 40,
      },
    });
  });

  afterAll(async () => {
    await prisma.vendorCostRule.deleteMany({ where: { listingId: hiddenListingId } });
    await prisma.vendorListing.deleteMany({ where: { vendorId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
    await prisma.$disconnect();
  });

  it("excludes listings that are not approved and active", async () => {
    const { rows } = await catalogueRepository.listListings({ vendorId }, { page: 1, pageSize: 48 });
    expect(rows.find((listing) => listing.id === hiddenListingId)).toBeUndefined();
  });

  it("getListingById returns null for a listing that is not publicly visible", async () => {
    const result = await catalogueRepository.getListingById(hiddenListingId);
    expect(result).toBeNull();
  });

  it("never exposes vendor cost/margin fields on a public listing detail", async () => {
    const { rows } = await catalogueRepository.listListings({}, { page: 1, pageSize: 1 });
    const [publicListing] = rows;
    expect(publicListing).toBeDefined();

    const detail = await catalogueRepository.getListingById(publicListing!.id);
    expect(detail).not.toBeNull();

    const keys = Object.keys(detail as object);
    expect(keys).not.toContain("vendorCostRule");
    expect(keys).not.toContain("vendorSupplyCost");
    expect(keys).not.toContain("marginValue");
    expect(keys).not.toContain("marginRuleType");
  });

  it("derives primaryImage as the first image on the summary, or null when there are none (M13.1)", async () => {
    const withImages = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Listing With Images",
        description: "Has product photos.",
        basePrice: 50,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
        images: ["vendor-listing-images/first.png", "vendor-listing-images/second.png"],
      },
    });
    const withoutImages = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Listing Without Images",
        description: "No product photos yet.",
        basePrice: 50,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });

    const { rows } = await catalogueRepository.listListings({ vendorId }, { page: 1, pageSize: 48 });
    const withImagesRow = rows.find((r) => r.id === withImages.id);
    const withoutImagesRow = rows.find((r) => r.id === withoutImages.id);

    expect(withImagesRow?.primaryImage).toBe("vendor-listing-images/first.png");
    expect(withoutImagesRow?.primaryImage).toBeNull();
  });

  it("getListingById returns the full uploaded images array (M13.1)", async () => {
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Listing With Gallery",
        description: "Multiple product photos.",
        basePrice: 50,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
        images: ["vendor-listing-images/a.png", "vendor-listing-images/b.jpg", "vendor-listing-images/c.webp"],
      },
    });

    const detail = await catalogueRepository.getListingById(listing.id);
    expect(detail?.images).toEqual(["vendor-listing-images/a.png", "vendor-listing-images/b.jpg", "vendor-listing-images/c.webp"]);
  });

  // --- M21.2: published-listing edit visibility correction ----------------

  it("a listing with a staged edit under re-review (approvalStatus PENDING, listingStatus ACTIVE) remains publicly visible", async () => {
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Live Listing Under Re-Review",
        description: "Still live while its edit awaits admin review.",
        basePrice: 100,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });

    // Simulates vendorListingsService.saveContent (staged) + submitForReview
    // on an already-live listing: pendingChanges is set and approvalStatus
    // flips to PENDING, but listingStatus stays ACTIVE.
    await prisma.vendorListing.update({
      where: { id: listing.id },
      data: {
        approvalStatus: "PENDING",
        submittedAt: new Date(),
        pendingChanges: { listing: { title: "Proposed New Title", basePrice: 999 }, bulkPriceTiers: [] },
      },
    });

    const detail = await catalogueRepository.getListingById(listing.id);
    expect(detail).not.toBeNull();
    expect(detail?.title).toBe("Live Listing Under Re-Review");
    expect(detail?.basePrice).toBe(100);

    const { rows } = await catalogueRepository.listListings({ vendorId }, { page: 1, pageSize: 48 });
    expect(rows.find((r) => r.id === listing.id)).toBeDefined();
  });

  it("a listing with a staged edit under CHANGES_REQUESTED re-review also remains publicly visible with its old live values", async () => {
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Live Listing With Changes Requested On Its Edit",
        description: "Admin asked for more changes on the proposed edit.",
        basePrice: 200,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });

    await prisma.vendorListing.update({
      where: { id: listing.id },
      data: {
        approvalStatus: "CHANGES_REQUESTED",
        changesRequestedReason: "Add more detail.",
        pendingChanges: { listing: { title: "Proposed Title", basePrice: 5000 }, bulkPriceTiers: [] },
      },
    });

    const detail = await catalogueRepository.getListingById(listing.id);
    expect(detail).not.toBeNull();
    expect(detail?.title).toBe("Live Listing With Changes Requested On Its Edit");
    expect(detail?.basePrice).toBe(200);
  });

  it("a never-approved listing (PENDING/DRAFT) stays private even with a submittedAt set", async () => {
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "First-Time Submission Awaiting Review",
        description: "Never been approved before.",
        basePrice: 50,
        approvalStatus: "PENDING",
        listingStatus: "DRAFT",
        submittedAt: new Date(),
      },
    });

    const detail = await catalogueRepository.getListingById(listing.id);
    expect(detail).toBeNull();
  });

  it("a rejected never-approved listing stays private", async () => {
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Rejected First-Time Submission",
        description: "Never went live.",
        basePrice: 50,
        approvalStatus: "REJECTED",
        listingStatus: "DRAFT",
        submittedAt: new Date(),
      },
    });

    const detail = await catalogueRepository.getListingById(listing.id);
    expect(detail).toBeNull();
  });

  it("an archived/inactive listing stays private regardless of approvalStatus", async () => {
    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Paused Listing",
        description: "Vendor toggled this off.",
        basePrice: 50,
        approvalStatus: "APPROVED",
        listingStatus: "INACTIVE",
      },
    });

    const detail = await catalogueRepository.getListingById(listing.id);
    expect(detail).toBeNull();
  });

  it("includes a parent category's subcategory listings when browsing the parent", async () => {
    const parent = await catalogueRepository.findCategoryBySlug("hair-beauty-supplies");
    expect(parent).not.toBeNull();
    expect(parent!.children.length).toBeGreaterThan(0);

    const childSlugs = new Set(parent!.children.map((child) => child.slug));
    const categoryIds = [parent!.id, ...parent!.children.map((child) => child.id)];
    const { rows } = await catalogueRepository.listListings({ categoryIds }, { page: 1, pageSize: 48 });

    const hasSubcategoryListing = rows.some((listing) => childSlugs.has(listing.category.slug));
    expect(hasSubcategoryListing).toBe(true);
  });
});
