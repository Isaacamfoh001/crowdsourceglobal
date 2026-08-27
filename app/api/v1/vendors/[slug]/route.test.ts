// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../../lib/db";
import { GET } from "./route";

/** Public, unauthenticated endpoint — no session mocking in this file. */
describe("GET /api/v1/vendors/[slug]", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdListingIds: string[] = [];
  const createdVendorIds: string[] = [];
  let categoryId: string;
  let approvedVendorSlug: string;
  let approvedVendorId: string;
  let activeListingId: string;
  let pendingVendorSlug: string;

  beforeAll(async () => {
    const category = await prisma.category.create({ data: { name: "M18.2 Storefront Category", slug: `m18-2-storefront-category-${suffix}` } });
    categoryId = category.id;

    const approvedVendor = await prisma.vendor.create({
      data: {
        companyName: "M18.2 Storefront Vendor",
        storefrontSlug: `m18-2-storefront-vendor-${suffix}`,
        verificationStatus: "APPROVED",
        description: "Public storefront description.",
        country: "Ghana",
        region: "Greater Accra",
        city: "Accra",
        logoUrl: "https://cdn.example.com/logo.png",
        sellerType: "INDIVIDUAL",
        // Private fields that must never appear on the public storefront DTO.
        contactEmail: "private-owner@example.com",
        contactPhone: "0000000000",
        pickupAddressLine1: "Secret Warehouse Rd",
        pickupContactPhone: "0000000001",
      },
    });
    approvedVendorId = approvedVendor.id;
    approvedVendorSlug = approvedVendor.storefrontSlug;
    createdVendorIds.push(approvedVendor.id);

    const active = await prisma.vendorListing.create({
      data: { vendorId: approvedVendorId, categoryId, title: "M18.2 Storefront Active Listing", description: "x", basePrice: 90, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    activeListingId = active.id;
    createdListingIds.push(active.id);

    const draft = await prisma.vendorListing.create({
      data: { vendorId: approvedVendorId, categoryId, title: "M18.2 Storefront Draft Listing", description: "x", basePrice: 90, approvalStatus: "PENDING", listingStatus: "DRAFT" },
    });
    createdListingIds.push(draft.id);

    const pendingVendor = await prisma.vendor.create({
      data: { companyName: "M18.2 Unapproved Vendor", storefrontSlug: `m18-2-unapproved-vendor-${suffix}`, verificationStatus: "PENDING" },
    });
    pendingVendorSlug = pendingVendor.storefrontSlug;
    createdVendorIds.push(pendingVendor.id);
  });

  afterAll(async () => {
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  function request(slug: string) {
    const req = new Request(`http://localhost/api/v1/vendors/${slug}`);
    expect(req.headers.get("authorization")).toBeNull();
    return req;
  }

  it("returns the public storefront + only active/approved listings, with no authentication", async () => {
    const response = await GET(request(approvedVendorSlug), { params: Promise.resolve({ slug: approvedVendorSlug }) });
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.vendor.companyName).toBe("M18.2 Storefront Vendor");
    expect(body.data.vendor.verificationStatus).toBe("APPROVED");
    const listingIds = body.data.listings.rows.map((row: { id: string }) => row.id);
    expect(listingIds).toEqual([activeListingId]);
  });

  it("returns 404 for an unapproved/pending vendor — never confirms its existence", async () => {
    const response = await GET(request(pendingVendorSlug), { params: Promise.resolve({ slug: pendingVendorSlug }) });
    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown slug", async () => {
    const response = await GET(request("not-a-real-vendor-slug"), { params: Promise.resolve({ slug: "not-a-real-vendor-slug" }) });
    expect(response.status).toBe(404);
  });

  it("never leaks finance/contact/pickup/private fields — only the deliberate public vendor DTO fields", async () => {
    const response = await GET(request(approvedVendorSlug), { params: Promise.resolve({ slug: approvedVendorSlug }) });
    const body = await response.json();

    expect(Object.keys(body.data.vendor).sort()).toEqual([
      "categorySlugs",
      "city",
      "companyName",
      "country",
      "description",
      "id",
      "logoUrl",
      "region",
      "sellerType",
      "storefrontSlug",
      "verificationStatus",
    ]);
    expect(JSON.stringify(body)).not.toContain("private-owner@example.com");
    expect(JSON.stringify(body)).not.toContain("Secret Warehouse Rd");
    expect(JSON.stringify(body)).not.toContain("0000000000");
    expect(JSON.stringify(body)).not.toContain("0000000001");
  });

  it("paginates the vendor's listings using the same envelope as /api/v1/listings", async () => {
    const response = await GET(request(approvedVendorSlug), { params: Promise.resolve({ slug: approvedVendorSlug }) });
    const body = await response.json();
    expect(body.data.listings).toMatchObject({ page: 1, pageSize: 24, total: 1, totalPages: 1 });
  });
});
