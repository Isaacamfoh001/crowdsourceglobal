// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";
import { quotationService } from "../../../../../../modules/quotation/service";

vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

const validDelivery = {
  recipientName: "Ama Customer",
  phone: "0244111222",
  addressLine1: "5 Customer Close",
  city: "Accra",
  region: "Greater Accra",
};

function sessionFor(user: { id: string; email: string; name: string }): Session {
  return {
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId: user.id, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function acceptRequest(quotationId: string, body: unknown) {
  return new Request(`http://localhost/api/v1/quotations/${quotationId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/quotations/[id]/accept", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdQuotationIds: string[] = [];
  const createdOrderIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
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
    const vendor = await prisma.vendor.create({ data: { companyName: `Accept Vendor ${label}`, storefrontSlug: `accept-vendor-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Accept Category ${label}`, slug: `accept-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Accept Listing", description: "Fixture.", basePrice: 15, moq: 1, availableQuantity: 50, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `accept-customer-${label}-${suffix}`, name: `Accept ${label}`, email: `accept.customer.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Accept ${label}` } });

    const generated = await quotationService.generateFromDraft(profile.id, user.id, user.email, [{ listingId: listing.id, quantity: 2 }]);
    if (!generated.ok) throw new Error(generated.error);
    createdQuotationIds.push(generated.value.quotationId);

    return { user, profileId: profile.id, quotationId: generated.value.quotationId };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(acceptRequest("x", validDelivery), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("rejects an invalid delivery region (reuses the shared deliverySchema)", async () => {
    const { user, quotationId } = await setup("bad-delivery");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await POST(acceptRequest(quotationId, { ...validDelivery, region: "" }), { params: Promise.resolve({ id: quotationId }) });
    expect(response.status).toBe(422);
  });

  it("accepts a valid quotation and creates the order once (idempotent on repeat calls)", async () => {
    const { user, quotationId } = await setup("happy-path");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    const first = await POST(acceptRequest(quotationId, validDelivery), { params: Promise.resolve({ id: quotationId }) });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.data.orderId).toEqual(expect.any(String));
    createdOrderIds.push(firstBody.data.orderId);

    const second = await POST(acceptRequest(quotationId, validDelivery), { params: Promise.resolve({ id: quotationId }) });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.data.orderId).toBe(firstBody.data.orderId);

    const order = await prisma.order.findUnique({ where: { id: firstBody.data.orderId } });
    expect(order?.status).toBe("PENDING_PAYMENT");
    expect(order?.paymentStatus).toBe("UNPAID");
  });

  it("returns 422 (not found) when another customer tries to accept someone else's quotation", async () => {
    const { quotationId } = await setup("victim");
    const attacker = await setup("attacker");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(attacker.user));
    const response = await POST(acceptRequest(quotationId, validDelivery), { params: Promise.resolve({ id: quotationId }) });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.message).toMatch(/not found/i);
  });
});
