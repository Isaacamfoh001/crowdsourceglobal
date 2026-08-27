// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../lib/db";
import { env } from "../../../../lib/env";
import { GET } from "./route";

/**
 * Public, unauthenticated endpoint — no session mocking anywhere in this
 * file. Fixture listings are scoped via `?category=<fixture slug>`, which
 * (unlike the unscoped feed) is exempt from the canonical-beauty-taxonomy
 * restriction in modules/catalogue/repository.ts's listingWhere() — see
 * that file's own doc comment. This keeps fixture data isolated from
 * whatever real/seeded listings already exist in the shared dev database.
 */
describe("GET /api/v1/listings", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdListingIds: string[] = [];
  let vendorId: string;
  let categoryId: string;
  let categorySlug: string;
  let approvedListingId: string;

  beforeAll(async () => {
    const vendor = await prisma.vendor.create({
      data: { companyName: "M18.2 Listings Vendor", storefrontSlug: `m18-2-listings-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    vendorId = vendor.id;

    const category = await prisma.category.create({ data: { name: "M18.2 Listings Category", slug: `m18-2-listings-category-${suffix}` } });
    categoryId = category.id;
    categorySlug = category.slug;

    const approved = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "M18.2 Approved Wig",
        description: "Publicly visible fixture listing.",
        images: ["vendor-listing-images/m18-2-fixture.png"],
        basePrice: 120,
        currency: "GHS",
        moq: 1,
        availableQuantity: 10,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });
    approvedListingId = approved.id;
    createdListingIds.push(approved.id);

    const draft = await prisma.vendorListing.create({
      data: { vendorId, categoryId, title: "M18.2 Draft Wig", description: "Must never be public.", basePrice: 50, approvalStatus: "PENDING", listingStatus: "DRAFT" },
    });
    createdListingIds.push(draft.id);

    const pending = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "M18.2 Pending Review Wig",
        description: "Submitted, awaiting admin decision — must never be public.",
        basePrice: 75,
        approvalStatus: "PENDING",
        listingStatus: "ACTIVE",
        submittedAt: new Date(),
      },
    });
    createdListingIds.push(pending.id);
  });

  afterAll(async () => {
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
    await prisma.$disconnect();
  });

  function request(query: string) {
    const req = new Request(`http://localhost/api/v1/listings?${query}`);
    expect(req.headers.get("authorization")).toBeNull();
    return req;
  }

  it("returns approved+active listings for a category, excluding DRAFT and PENDING", async () => {
    const response = await GET(request(`category=${categorySlug}`));
    expect(response.status).toBe(200);
    const body = await response.json();

    const ids = body.data.rows.map((row: { id: string }) => row.id);
    expect(ids).toContain(approvedListingId);
    expect(ids).toHaveLength(1);
  });

  it("returns 404 for an unknown category slug", async () => {
    const response = await GET(request("category=not-a-real-category-slug"));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("supports search (?q=) scoped to the fixture category", async () => {
    const response = await GET(request(`category=${categorySlug}&q=Approved`));
    const body = await response.json();
    expect(body.data.rows.map((row: { id: string }) => row.id)).toEqual([approvedListingId]);

    const noMatch = await GET(request(`category=${categorySlug}&q=NoSuchTermAtAll`));
    expect((await noMatch.json()).data.rows).toEqual([]);
  });

  it("returns money as a fixed 2dp string + currency, never a float, and a correct pagination envelope", async () => {
    const response = await GET(request(`category=${categorySlug}`));
    const body = await response.json();
    const [listing] = body.data.rows;

    expect(listing.price).toEqual({ amount: "120.00", currency: "GHS" });
    expect(body.data).toMatchObject({ page: 1, pageSize: 24, total: 1, totalPages: 1 });
  });

  it("resolves a stored image key to an absolute HTTPS-capable URL a native client can fetch directly", async () => {
    const response = await GET(request(`category=${categorySlug}`));
    const body = await response.json();
    const [listing] = body.data.rows;

    expect(listing.primaryImage).toBe(`${env.NEXT_PUBLIC_APP_URL}/api/listings/images/vendor-listing-images%2Fm18-2-fixture.png`);
  });

  it("returns only the deliberate summary DTO fields — no description/specs/internal fields", async () => {
    const response = await GET(request(`category=${categorySlug}`));
    const body = await response.json();
    const [listing] = body.data.rows;

    expect(Object.keys(listing).sort()).toEqual([
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
    expect(Object.keys(listing.category).sort()).toEqual(["id", "name", "slug"]);
    expect(Object.keys(listing.vendor).sort()).toEqual(["companyName", "id", "storefrontSlug"]);
  });
});
