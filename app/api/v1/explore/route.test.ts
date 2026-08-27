// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../lib/db";
import { GET } from "./route";

/**
 * Public, unauthenticated endpoint — no session mocking in this file.
 * Uses the real canonical "hair-wigs" category, same reasoning as
 * app/api/v1/home/route.test.ts — catalogueService.listExploreSections
 * iterates the real canonical top-level taxonomy, so a section can only
 * ever exist for one of those categories.
 */
describe("GET /api/v1/explore", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdListingIds: string[] = [];
  let vendorId: string;
  let hairWigsCategoryId: string;
  let approvedListingId: string;
  let draftListingId: string;

  beforeAll(async () => {
    const hairWigs = await prisma.category.findUniqueOrThrow({ where: { slug: "hair-wigs" } });
    hairWigsCategoryId = hairWigs.id;

    const vendor = await prisma.vendor.create({
      data: { companyName: "M18.2 Explore Vendor", storefrontSlug: `m18-2-explore-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    vendorId = vendor.id;

    const approved = await prisma.vendorListing.create({
      data: { vendorId, categoryId: hairWigsCategoryId, title: `M18.2 Explore Fresh Listing ${suffix}`, description: "x", basePrice: 60, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    approvedListingId = approved.id;
    createdListingIds.push(approved.id);

    const draft = await prisma.vendorListing.create({
      data: { vendorId, categoryId: hairWigsCategoryId, title: `M18.2 Explore Fresh Draft ${suffix}`, description: "x", basePrice: 60, approvalStatus: "PENDING", listingStatus: "DRAFT" },
    });
    draftListingId = draft.id;
    createdListingIds.push(draft.id);
  });

  afterAll(async () => {
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
    await prisma.$disconnect();
  });

  function request() {
    const req = new Request("http://localhost/api/v1/explore");
    expect(req.headers.get("authorization")).toBeNull();
    return req;
  }

  it("succeeds with no authentication and returns category-grouped sections", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.data.sections)).toBe(true);
  });

  it("includes a section for hair-wigs containing the fresh approved listing, never the draft", async () => {
    const response = await GET(request());
    const body = await response.json();

    const hairWigsSection = body.data.sections.find((s: { category: { slug: string } }) => s.category.slug === "hair-wigs");
    expect(hairWigsSection).toBeDefined();
    const ids = hairWigsSection.listings.map((l: { id: string }) => l.id);
    expect(ids).toContain(approvedListingId);
    expect(ids).not.toContain(draftListingId);
  });

  it("never returns an empty section — a category with no live listings is omitted entirely", async () => {
    const response = await GET(request());
    const body = await response.json();

    for (const section of body.data.sections) {
      expect(section.listings.length).toBeGreaterThan(0);
    }
  });

  it("uses the same lightweight listing-card DTO as /api/v1/listings and /api/v1/home", async () => {
    const response = await GET(request());
    const body = await response.json();
    const hairWigsSection = body.data.sections.find((s: { category: { slug: string } }) => s.category.slug === "hair-wigs");

    expect(Object.keys(hairWigsSection.category).sort()).toEqual(["id", "name", "parentCategoryId", "slug"]);
    expect(Object.keys(hairWigsSection.listings[0]).sort()).toEqual([
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
  });
});
