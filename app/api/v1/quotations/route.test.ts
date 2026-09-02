// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";
import { quotationService } from "../../../../modules/quotation/service";

vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
import { GET } from "./route";
import { GET as GET_DETAIL } from "./[id]/route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(user: { id: string; email: string; name: string }): Session {
  return {
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId: user.id, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

describe("GET /api/v1/quotations, GET /api/v1/quotations/[id]", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdQuotationIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.quotationItem.deleteMany({ where: { quotationId: { in: createdQuotationIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: createdQuotationIds } } });
    await prisma.vendorCostRule.deleteMany({ where: { listingId: { in: createdListingIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function setup(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `QR Vendor ${label}`, storefrontSlug: `qr-vendor-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `QR Category ${label}`, slug: `qr-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "QR Listing", description: "Fixture.", basePrice: 20, moq: 1, availableQuantity: 100, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `qr-customer-${label}-${suffix}`, name: `QR ${label}`, email: `qr.customer.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `QR ${label}` } });

    const generated = await quotationService.generateFromDraft(profile.id, user.id, user.email, [{ listingId: listing.id, quantity: 2 }]);
    if (!generated.ok) throw new Error(generated.error);
    createdQuotationIds.push(generated.value.quotationId);

    return { user, profileId: profile.id, quotationId: generated.value.quotationId };
  }

  it("returns 401 when signed out for both list and detail", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/v1/quotations"))).status).toBe(401);
    expect((await GET_DETAIL(new Request("http://localhost/api/v1/quotations/x"), { params: Promise.resolve({ id: "x" }) })).status).toBe(401);
  });

  it("lists the signed-in customer's own quotations and returns a DTO-safe detail", async () => {
    const { user, quotationId } = await setup("self");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    const listResponse = await GET(new Request("http://localhost/api/v1/quotations"));
    const listBody = await listResponse.json();
    expect(listBody.data.rows.some((r: { id: string }) => r.id === quotationId)).toBe(true);

    const detailResponse = await GET_DETAIL(new Request(`http://localhost/api/v1/quotations/${quotationId}`), { params: Promise.resolve({ id: quotationId }) });
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.data.status).toBe("ISSUED");
    expect(detailBody.data.items).toHaveLength(1);
    expect(detailBody.data.items[0]).not.toHaveProperty("vendorPayableBasis");
  });

  it("returns 404 for another customer's quotation", async () => {
    const { quotationId } = await setup("owner");
    const other = await setup("other");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(other.user));
    const response = await GET_DETAIL(new Request(`http://localhost/api/v1/quotations/${quotationId}`), { params: Promise.resolve({ id: quotationId }) });
    expect(response.status).toBe(404);
  });
});
