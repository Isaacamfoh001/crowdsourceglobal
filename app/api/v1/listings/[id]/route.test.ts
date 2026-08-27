// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../../lib/db";
import { GET } from "./route";

/** Public, unauthenticated endpoint — no session mocking in this file. */
describe("GET /api/v1/listings/[id]", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdListingIds: string[] = [];
  let vendorId: string;
  let categoryId: string;
  let approvedListingId: string;
  let draftListingId: string;
  let pendingListingId: string;
  let hasPendingChangesListingId: string;

  beforeAll(async () => {
    const vendor = await prisma.vendor.create({
      data: { companyName: "M18.2 Detail Vendor", storefrontSlug: `m18-2-detail-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana", description: "A trusted beauty supplier." },
    });
    vendorId = vendor.id;

    const category = await prisma.category.create({ data: { name: "M18.2 Detail Category", slug: `m18-2-detail-category-${suffix}` } });
    categoryId = category.id;

    const approved = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "M18.2 Detail Wig",
        description: "A full detail description.",
        images: ["vendor-listing-images/m18-2-detail.png", "https://cdn.example.com/external.png"],
        specs: { "Hair type": "Human hair", Length: "22 inch" },
        basePrice: 450,
        currency: "GHS",
        moq: 2,
        maxOq: 50,
        leadTimeDays: 5,
        availableQuantity: 30,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });
    approvedListingId = approved.id;
    createdListingIds.push(approved.id);

    await prisma.bulkPriceTier.create({ data: { listingId: approved.id, minQuantity: 5, maxQuantity: 19, unitPrice: 400 } });

    await prisma.vendorCostRule.create({
      data: { listingId: approved.id, vendorSupplyCost: 200, marginRuleType: "PERCENTAGE", marginValue: 55 },
    });

    const draft = await prisma.vendorListing.create({
      data: { vendorId, categoryId, title: "M18.2 Detail Draft", description: "x", basePrice: 10, approvalStatus: "PENDING", listingStatus: "DRAFT" },
    });
    draftListingId = draft.id;
    createdListingIds.push(draft.id);

    const pending = await prisma.vendorListing.create({
      data: { vendorId, categoryId, title: "M18.2 Detail Pending", description: "x", basePrice: 10, approvalStatus: "PENDING", listingStatus: "ACTIVE", submittedAt: new Date() },
    });
    pendingListingId = pending.id;
    createdListingIds.push(pending.id);

    const withPendingChanges = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "M18.2 Live Listing With A Pending Edit",
        description: "x",
        basePrice: 10,
        approvalStatus: "PENDING",
        listingStatus: "ACTIVE",
        submittedAt: new Date(),
        pendingChanges: { title: "SECRET-UNPUBLISHED-TITLE-CHANGE" },
      },
    });
    hasPendingChangesListingId = withPendingChanges.id;
    createdListingIds.push(withPendingChanges.id);
  });

  afterAll(async () => {
    await prisma.bulkPriceTier.deleteMany({ where: { listingId: approvedListingId } });
    await prisma.vendorCostRule.deleteMany({ where: { listingId: approvedListingId } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.vendor.deleteMany({ where: { id: vendorId } });
    await prisma.$disconnect();
  });

  function request(id: string) {
    const req = new Request(`http://localhost/api/v1/listings/${id}`);
    expect(req.headers.get("authorization")).toBeNull();
    return req;
  }

  it("returns full public detail for an approved+active listing with no authentication", async () => {
    const response = await GET(request(approvedListingId), { params: Promise.resolve({ id: approvedListingId }) });
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.id).toBe(approvedListingId);
    expect(body.data.description).toBe("A full detail description.");
    expect(body.data.specs).toEqual({ "Hair type": "Human hair", Length: "22 inch" });
    expect(body.data.price).toEqual({ amount: "450.00", currency: "GHS" });
    expect(body.data.moq).toBe(2);
    expect(body.data.maxOq).toBe(50);
    expect(body.data.leadTimeDays).toBe(5);
    expect(body.data.availableQuantity).toBe(30);
    expect(body.data.vendor).toEqual({ id: vendorId, companyName: "M18.2 Detail Vendor", storefrontSlug: expect.any(String), description: "A trusted beauty supplier." });
    expect(body.data.bulkPriceTiers).toEqual([{ id: expect.any(String), minQuantity: 5, maxQuantity: 19, unitPrice: { amount: "400.00", currency: "GHS" } }]);
  });

  it("returns both a resolved storage-key image and an untouched external image URL, both absolute/fetchable", async () => {
    const response = await GET(request(approvedListingId), { params: Promise.resolve({ id: approvedListingId }) });
    const body = await response.json();

    expect(body.data.images[0]).toMatch(/^http:\/\/localhost:3000\/api\/listings\/images\//);
    expect(body.data.images[1]).toBe("https://cdn.example.com/external.png");
  });

  it("returns 404, never 403, for a DRAFT listing — existence is never confirmed", async () => {
    const response = await GET(request(draftListingId), { params: Promise.resolve({ id: draftListingId }) });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for a PENDING (submitted, awaiting admin decision) listing", async () => {
    const response = await GET(request(pendingListingId), { params: Promise.resolve({ id: pendingListingId }) });
    expect(response.status).toBe(404);
  });

  it("returns 404 for an id that doesn't exist at all", async () => {
    const response = await GET(request("not-a-real-id"), { params: Promise.resolve({ id: "not-a-real-id" }) });
    expect(response.status).toBe(404);
  });

  it("never leaks vendor cost/margin data for an approved listing that has a VendorCostRule", async () => {
    const response = await GET(request(approvedListingId), { params: Promise.resolve({ id: approvedListingId }) });
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/vendorSupplyCost|marginRuleType|marginValue/);
  });

  it("never leaks a queued pendingChanges edit, even for a listing that is otherwise publicly visible", async () => {
    // This listing is still approvalStatus PENDING (a live edit awaiting
    // re-review) so it correctly 404s — pendingChanges must not leak even
    // via the 404 path (which returns no body content from the listing at all).
    const response = await GET(request(hasPendingChangesListingId), { params: Promise.resolve({ id: hasPendingChangesListingId }) });
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain("SECRET-UNPUBLISHED-TITLE-CHANGE");
  });

  it("returns only the deliberate detail DTO fields", async () => {
    const response = await GET(request(approvedListingId), { params: Promise.resolve({ id: approvedListingId }) });
    const body = await response.json();

    expect(Object.keys(body.data).sort()).toEqual([
      "availabilityStatus",
      "availableQuantity",
      "bulkPriceTiers",
      "category",
      "description",
      "id",
      "images",
      "leadTimeDays",
      "maxOq",
      "moq",
      "price",
      "specs",
      "title",
      "vendor",
    ]);
  });
});
