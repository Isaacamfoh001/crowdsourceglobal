// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";

/**
 * M30 — GET/POST /api/v1/vendor/messages. Thin routes over the EXISTING
 * messagingService.listForVendor / startVendorConversation /
 * startOrContinueVendorContextual. Verifies: auth, non-vendor rejection,
 * own-conversations-only listing, and that a forged
 * contextResolutionCaseId belonging to a different vendor is rejected (the
 * ownership check added to messagingService.startOrContinueVendorContextual
 * for this milestone — see modules/messaging/service.test.ts).
 */
vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { GET, POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/v1/vendor/messages", { method: "POST", body: JSON.stringify(body) });
}

describe("/api/v1/vendor/messages", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCustomerProfileIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdConversationIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversationIds } } });
    await prisma.resolutionCaseItem.deleteMany({ where: { orderItem: { orderId: { in: createdOrderIds } } } });
    await prisma.resolutionCase.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerProfileIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendorMembership.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeVendorOwner(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `Vendor Msg API ${label}`, storefrontSlug: `vendor-msg-api-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const owner = await prisma.user.create({ data: { id: `vendor-msg-owner-${label}-${suffix}`, name: `Owner ${label}`, email: `vendor.msg.owner.${label}.${suffix}@example.com` } });
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });
    return { vendor, owner };
  }

  async function makeResolutionCaseForVendor(vendorId: string, label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const category = await prisma.category.create({ data: { name: `Vendor Msg API Cat ${label}`, slug: `vendor-msg-api-cat-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { title: "Vendor Msg API Listing", description: "x", basePrice: 25, vendorId, categoryId: category.id, availableQuantity: 50, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const customerUser = await prisma.user.create({ data: { id: `vendor-msg-cust-${label}-${suffix}`, name: "Customer", email: `vendor.msg.cust.${label}.${suffix}@example.com` } });
    createdUserIds.push(customerUser.id);
    const customerProfile = await prisma.customerProfile.create({ data: { userId: customerUser.id, displayName: "Customer" } });
    createdCustomerProfileIds.push(customerProfile.id);

    const order = await prisma.order.create({
      data: {
        orderNumber: `VMSG-${suffix}`,
        customerProfileId: customerProfile.id,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: 25,
        total: 25,
        fulfilmentsCreatedAt: new Date(),
        deliveryInfo: { recipientName: "Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdOrderIds.push(order.id);
    const orderItem = await prisma.orderItem.create({
      data: { orderId: order.id, listingId: listing.id, vendorId, description: "Vendor Msg API Item", quantity: 1, unitPrice: 25, vendorPayableBasis: 17.5, lineTotal: 25 },
    });
    const fulfilment = await prisma.fulfilment.create({ data: { orderId: order.id, vendorId, origin: "DOMESTIC_COLLECTION" } });
    await prisma.fulfilmentItem.create({ data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: 1, unitPrice: 25, vendorPayableBasis: 17.5 } });
    await prisma.shipment.create({ data: { fulfilmentId: fulfilment.id } });

    const submitted = await resolutionsService.submitCase(customerProfile.id, customerUser.id, {
      orderId: order.id,
      issueType: "ITEM_DAMAGED",
      description: "Vendor Msg API fixture case.",
      items: [{ orderItemId: orderItem.id, quantity: 1 }],
    });
    if (!submitted.ok) throw new Error(submitted.error);
    return submitted.value.caseId;
  }

  describe("GET", () => {
    it("returns 401 when signed out", async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(null);
      const response = await GET(new Request("http://localhost/api/v1/vendor/messages"));
      expect(response.status).toBe(401);
    });

    it("returns 403 for a signed-in user with no vendor membership", async () => {
      const suffix = `${Date.now()}`;
      const user = await prisma.user.create({ data: { id: `vendor-msg-nonvendor-${suffix}`, name: "Not a vendor", email: `vendor.msg.nonvendor.${suffix}@example.com` } });
      createdUserIds.push(user.id);
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
      const response = await GET(new Request("http://localhost/api/v1/vendor/messages"));
      expect(response.status).toBe(403);
    });

    it("returns only this vendor's own conversations", async () => {
      const a = await makeVendorOwner("list-a");
      const b = await makeVendorOwner("list-b");

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(a.owner.id));
      const started = await POST(postRequest({ body: "Contact from vendor A" }));
      const startedBody = await started.json();
      createdConversationIds.push(startedBody.data.conversationId);

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(b.owner.id));
      const bList = await GET(new Request("http://localhost/api/v1/vendor/messages"));
      const bBody = await bList.json();
      expect(bBody.data.rows).toHaveLength(0);

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(a.owner.id));
      const aList = await GET(new Request("http://localhost/api/v1/vendor/messages"));
      const aBody = await aList.json();
      expect(aBody.data.rows).toHaveLength(1);
      expect(aBody.data.rows[0].id).toBe(startedBody.data.conversationId);
    });
  });

  describe("POST", () => {
    it("returns 401 when signed out", async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(null);
      const response = await POST(postRequest({ body: "hi" }));
      expect(response.status).toBe(401);
    });

    it("rejects an empty body", async () => {
      const a = await makeVendorOwner("empty");
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(a.owner.id));
      const response = await POST(postRequest({ body: "   " }));
      expect(response.status).toBe(422);
    });

    it("starts a general conversation with CrownSourceGlobal", async () => {
      const a = await makeVendorOwner("general");
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(a.owner.id));
      const response = await POST(postRequest({ body: "How do I set up bulk pricing?" }));
      expect(response.status).toBe(200);
      const body = await response.json();
      createdConversationIds.push(body.data.conversationId);
    });

    it("rejects a resolution case id that belongs to a different vendor (IDOR)", async () => {
      const a = await makeVendorOwner("case-a");
      const b = await makeVendorOwner("case-b");
      const caseIdForA = await makeResolutionCaseForVendor(a.vendor.id, "case-a");

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(b.owner.id));
      const response = await POST(postRequest({ contextResolutionCaseId: caseIdForA, body: "Trying to probe vendor A's case." }));
      expect(response.status).toBe(422);
    });

    it("starts a contextual conversation about the vendor's own resolution case", async () => {
      const a = await makeVendorOwner("case-own");
      const caseId = await makeResolutionCaseForVendor(a.vendor.id, "case-own");

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(a.owner.id));
      const response = await POST(postRequest({ contextResolutionCaseId: caseId, body: "Can you tell me more?" }));
      expect(response.status).toBe(200);
      const body = await response.json();
      createdConversationIds.push(body.data.conversationId);
    });
  });
});
