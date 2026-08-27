// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../lib/db";
import { GET } from "./route";

/**
 * Public, unauthenticated endpoint — no session mocking in this file.
 * Fixture listings are created under the REAL canonical "hair-wigs"
 * category (seeded reference data, not a throwaway fixture category)
 * because catalogueService.listFeaturedListings ultimately calls
 * listListingsCapped({}, take) — an UNSCOPED query, which (per
 * modules/catalogue/repository.ts's listingWhere()) is restricted to the
 * canonical beauty taxonomy. A listing under an ad hoc fixture category
 * would silently never appear here, which would make this test misleading
 * rather than merely inconvenient.
 */
describe("GET /api/v1/home", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdListingIds: string[] = [];
  let vendorId: string;
  let hairWigsCategoryId: string;
  let freshApprovedListingId: string;
  let freshDraftListingId: string;

  beforeAll(async () => {
    const hairWigs = await prisma.category.findUniqueOrThrow({ where: { slug: "hair-wigs" } });
    hairWigsCategoryId = hairWigs.id;

    const vendor = await prisma.vendor.create({
      data: { companyName: "M18.2 Home Vendor", storefrontSlug: `m18-2-home-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    vendorId = vendor.id;

    const approved = await prisma.vendorListing.create({
      data: { vendorId, categoryId: hairWigsCategoryId, title: `M18.2 Home Fresh Listing ${suffix}`, description: "x", basePrice: 60, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    freshApprovedListingId = approved.id;
    createdListingIds.push(approved.id);

    const draft = await prisma.vendorListing.create({
      data: { vendorId, categoryId: hairWigsCategoryId, title: `M18.2 Home Fresh Draft ${suffix}`, description: "x", basePrice: 60, approvalStatus: "PENDING", listingStatus: "DRAFT" },
    });
    freshDraftListingId = draft.id;
    createdListingIds.push(draft.id);
  });

  afterAll(async () => {
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
    await prisma.$disconnect();
  });

  function request() {
    const req = new Request("http://localhost/api/v1/home");
    expect(req.headers.get("authorization")).toBeNull();
    return req;
  }

  it("succeeds with no authentication and returns categories + featured listings", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.categories.some((c: { slug: string }) => c.slug === "hair-wigs")).toBe(true);
    expect(Array.isArray(body.data.featuredListings)).toBe(true);
  });

  it("includes the most recently approved+active listing among featured, and never a draft", async () => {
    const response = await GET(request());
    const body = await response.json();
    const ids = body.data.featuredListings.map((l: { id: string }) => l.id);

    expect(ids).toContain(freshApprovedListingId);
    expect(ids).not.toContain(freshDraftListingId);
  });

  it("does not exceed 6 featured listings and uses the same lightweight card DTO as /api/v1/listings", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(body.data.featuredListings.length).toBeLessThanOrEqual(6);
    if (body.data.featuredListings.length > 0) {
      expect(Object.keys(body.data.featuredListings[0]).sort()).toEqual([
        "availabilityStatus",
        "category",
        "hasBulkPricing",
        "id",
        "moq",
        "price",
        "primaryImage",
        "title",
        "vendor",
      ]);
    }
  });

  it("returns only categories/featuredListings — no invented sections such as featured vendors", async () => {
    const response = await GET(request());
    const body = await response.json();
    expect(Object.keys(body.data).sort()).toEqual(["categories", "featuredListings"]);
  });
});
