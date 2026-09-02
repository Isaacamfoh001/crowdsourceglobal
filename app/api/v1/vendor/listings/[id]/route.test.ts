// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";

/**
 * M27 §26 — "Vendor A cannot access Vendor B listing" / "Vendor A cannot
 * edit Vendor B listing." Same convention as the vendor/orders/[id] and
 * payout-destination route tests: only getCurrentSession is stubbed, the
 * real vendorListingsService (already vendorId-scoped) runs against the
 * local dev database.
 */
vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { GET, PATCH } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function getRequest(id: string) {
  return new Request(`http://localhost/api/v1/vendor/listings/${id}`);
}

function patchForm() {
  const form = new FormData();
  form.append("title", "Hijacked title");
  form.append("description", "Attempted takeover of another vendor's listing");
  form.append("categoryId", "does-not-matter");
  form.append("basePrice", "10");
  form.append("moq", "1");
  form.append("bulkTiers", "[]");
  return new Request("http://localhost/api/v1/vendor/listings/x", { method: "PATCH", body: form });
}

describe("GET/PATCH /api/v1/vendor/listings/:id — multi-vendor privacy", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeVendorWithOwner(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `${label} Co`, storefrontSlug: `m27-listing-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const owner = await prisma.user.create({ data: { id: `m27-l-${label}-${suffix}`, name: `${label} Owner`, email: `m27.l.${label}.${suffix}@example.com` } });
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });
    return { vendorId: vendor.id, ownerUserId: owner.id };
  }

  async function makeListingForVendor(vendorId: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: "M27 Listing Category", slug: `m27-listing-cat-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { title: "Original Title", description: "Original description", basePrice: 50, vendorId, categoryId: category.id },
    });
    createdListingIds.push(listing.id);
    return listing.id;
  }

  it("GET returns 404 (never Vendor B's listing) when Vendor A requests it", async () => {
    const vendorA = await makeVendorWithOwner("ga");
    const vendorB = await makeVendorWithOwner("gb");
    const listingId = await makeListingForVendor(vendorB.vendorId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(vendorA.ownerUserId));

    const response = await GET(getRequest(listingId), { params: Promise.resolve({ id: listingId }) });

    expect(response.status).toBe(404);
  });

  it("PATCH cannot edit Vendor B's listing from Vendor A's session", async () => {
    const vendorA = await makeVendorWithOwner("pa");
    const vendorB = await makeVendorWithOwner("pb");
    const listingId = await makeListingForVendor(vendorB.vendorId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(vendorA.ownerUserId));

    const response = await PATCH(patchForm(), { params: Promise.resolve({ id: listingId }) });
    expect(response.status).toBe(422);

    const listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(listing?.title).toBe("Original Title");
  });

  it("GET/PATCH succeed for the owning vendor", async () => {
    const vendorA = await makeVendorWithOwner("owna");
    const listingId = await makeListingForVendor(vendorA.vendorId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(vendorA.ownerUserId));

    const getResponse = await GET(getRequest(listingId), { params: Promise.resolve({ id: listingId }) });
    expect(getResponse.status).toBe(200);
  });
});
