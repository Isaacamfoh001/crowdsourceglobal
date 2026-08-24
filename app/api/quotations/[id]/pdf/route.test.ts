// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";
import { quotationService } from "../../../../../modules/quotation/service";

/**
 * Only getCurrentSession is stubbed — getCurrentCustomerProfile stays real
 * (hits the DB, like every other test in this suite) so authorization here
 * exercises the exact same code path the customer quote detail page uses,
 * not a re-implementation of it.
 */
vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: "", emailVerified: false, name: "", createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

/** Integration test against the real local Postgres dev database, same conventions as modules/quotation/service.test.ts. */
describe("GET /api/quotations/[id]/pdf", () => {
  let vendorId: string;
  let categoryId: string;
  let customerAId: string;
  let customerAUserId: string;
  let customerBUserId: string;
  let quotationId: string;
  let quotationReference: string;

  const createdVendorIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdQuotationIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendor = await prisma.vendor.create({
      data: { companyName: "M15.1 Vendor", storefrontSlug: `m15-1-vendor-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    vendorId = vendor.id;
    createdVendorIds.push(vendor.id);

    const category = await prisma.category.create({ data: { name: "M15.1 Category", slug: `m15-1-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "M15.1 Listing",
        description: "Fixture.",
        basePrice: 40,
        moq: 1,
        availableQuantity: 100,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });
    createdListingIds.push(listing.id);

    const userA = await prisma.user.create({
      data: { id: `m15-1-customer-a-${suffix}`, name: "Ama Customer", email: `m15.1.customer.a.${suffix}@example.com` },
    });
    createdUserIds.push(userA.id);
    customerAUserId = userA.id;
    const customerA = await prisma.customerProfile.create({ data: { userId: userA.id, displayName: "Ama Customer" } });
    customerAId = customerA.id;

    const userB = await prisma.user.create({
      data: { id: `m15-1-customer-b-${suffix}`, name: "Kofi Other", email: `m15.1.customer.b.${suffix}@example.com` },
    });
    createdUserIds.push(userB.id);
    customerBUserId = userB.id;
    await prisma.customerProfile.create({ data: { userId: userB.id, displayName: "Kofi Other" } });

    const result = await quotationService.generateFromDraft(customerAId, customerAUserId, userA.email, [
      { listingId: listing.id, quantity: 2 },
    ]);
    if (!result.ok) throw new Error(result.error);
    quotationId = result.value.quotationId;
    quotationReference = result.value.reference;
    createdQuotationIds.push(quotationId);
  });

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.quotationItem.deleteMany({ where: { quotationId: { in: createdQuotationIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: createdQuotationIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  function request() {
    return new Request(`http://localhost/api/quotations/${quotationId}/pdf`);
  }

  it("lets the owning customer download their own quotation as a PDF", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(customerAUserId));

    const response = await GET(request(), { params: Promise.resolve({ id: quotationId }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(`CrownSourceGlobal-Quotation-${quotationReference}.pdf`);
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("returns 404 for a quotation another customer owns", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(customerBUserId));

    const response = await GET(request(), { params: Promise.resolve({ id: quotationId }) });

    expect(response.status).toBe(404);
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);

    const response = await GET(request(), { params: Promise.resolve({ id: quotationId }) });

    expect(response.status).toBe(401);
  });

  it("does not mutate the quotation's status or amounts when downloaded", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(customerAUserId));

    const before = await prisma.quotation.findUniqueOrThrow({ where: { id: quotationId } });
    const response = await GET(request(), { params: Promise.resolve({ id: quotationId }) });
    expect(response.status).toBe(200);
    const after = await prisma.quotation.findUniqueOrThrow({ where: { id: quotationId } });

    expect(after.status).toBe(before.status);
    expect(after.total.toNumber()).toBe(before.total.toNumber());
    expect(after.acceptedAt).toEqual(before.acceptedAt);
  });
});
