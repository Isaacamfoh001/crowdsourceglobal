// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";

/**
 * M29.1 — POST /api/v1/resolutions (mobile "Report a problem" case
 * creation). Thin route over the EXISTING resolutionsService.submitCase +
 * addAttachment — the exact same calls the web submitResolutionCaseAction
 * makes. Verifies: auth, cross-customer ownership (a customer cannot
 * report against another customer's order — the same check
 * modules/resolutions/service.test.ts already covers at the service layer;
 * this proves the route surfaces it correctly), invalid order rejected,
 * and a valid submission creates a real, OPEN case with no client control
 * over outcome/refund (the route accepts no such field at all).
 */
vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
import { POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function postForm(fields: Record<string, string | string[]>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) for (const v of value) form.append(key, v);
    else form.append(key, value);
  }
  return new Request("http://localhost/api/v1/resolutions", { method: "POST", body: form });
}

describe("POST /api/v1/resolutions", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdCustomerProfileIds: string[] = [];
  const createdOrderIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.resolutionCaseItem.deleteMany({ where: { orderItem: { orderId: { in: createdOrderIds } } } });
    await prisma.resolutionCase.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerProfileIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.$disconnect();
  });

  async function makeOrder(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const category = await prisma.category.create({ data: { name: `Res Create ${label}`, slug: `m29-rescreate-cat-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const vendor = await prisma.vendor.create({ data: { companyName: `Res Create Vendor ${label}`, storefrontSlug: `m29-rescreate-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdVendorIds.push(vendor.id);
    const listing = await prisma.vendorListing.create({
      data: { title: "Res Create Listing", description: "x", basePrice: 30, vendorId: vendor.id, categoryId: category.id, availableQuantity: 100, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const customerUser = await prisma.user.create({ data: { id: `m29-rescreate-cust-${label}-${suffix}`, name: "Create Customer", email: `m29.rescreate.${label}.${suffix}@example.com` } });
    createdUserIds.push(customerUser.id);
    const customerProfile = await prisma.customerProfile.create({ data: { userId: customerUser.id, displayName: "Create Customer" } });
    createdCustomerProfileIds.push(customerProfile.id);

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-REC-${suffix}`,
        customerProfileId: customerProfile.id,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: 30,
        total: 30,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "Create Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdOrderIds.push(order.id);
    const orderItem = await prisma.orderItem.create({
      data: { orderId: order.id, listingId: listing.id, vendorId: vendor.id, description: "Res Create Item", quantity: 1, unitPrice: 30, vendorPayableBasis: 21, lineTotal: 30 },
    });
    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId: vendor.id, origin: "DOMESTIC_COLLECTION", status: "PENDING" } });
    await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 1, unitPrice: 30, vendorPayableBasis: 21 } });
    await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id } });

    return { orderId: order.id, orderItemId: orderItem.id, customerUserId: customerUser.id };
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const res = await POST(postForm({ orderId: "x", issueType: "ITEM_DAMAGED", description: "test test test" }));
    expect(res.status).toBe(401);
  });

  it("rejects reporting a problem against another customer's order", async () => {
    const owned = await makeOrder("create-owner");
    const other = await makeOrder("create-other");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(other.customerUserId));
    const res = await POST(
      postForm({
        orderId: owned.orderId,
        issueType: "ITEM_DAMAGED",
        description: "Trying to report someone else's order.",
        orderItemId: owned.orderItemId,
        quantity: "1",
      }),
    );
    expect(res.status).toBe(422);

    const cases = await prisma.resolutionCase.findMany({ where: { orderId: owned.orderId } });
    expect(cases).toHaveLength(0);
  });

  it("rejects an unknown order id", async () => {
    const { customerUserId } = await makeOrder("create-unknown");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(customerUserId));
    const res = await POST(
      postForm({ orderId: "does-not-exist", issueType: "ITEM_DAMAGED", description: "test test test", orderItemId: "x", quantity: "1" }),
    );
    expect(res.status).toBe(422);
  });

  it("creates a real, OPEN case for a valid submission — no client control over outcome/refund", async () => {
    const { orderId, orderItemId, customerUserId } = await makeOrder("create-happy");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(customerUserId));

    const res = await POST(
      postForm({
        orderId,
        issueType: "ITEM_DAMAGED",
        description: "The item arrived cracked and unusable.",
        orderItemId,
        quantity: "1",
        // Forged fields the route doesn't even read — proves they're inert.
        status: "RESOLVED",
        approvedRefundAmount: "999999",
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.caseId).toBeTruthy();

    const created = await prisma.resolutionCase.findUnique({ where: { id: body.data.caseId } });
    expect(created?.status).toBe("OPEN");
    expect(created?.orderId).toBe(orderId);

    const refunds = await prisma.refund.findMany({ where: { resolutionCaseId: body.data.caseId } });
    expect(refunds).toHaveLength(0);
  });
});
