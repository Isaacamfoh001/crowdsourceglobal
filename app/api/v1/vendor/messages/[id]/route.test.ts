// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";
import { messagingService } from "../../../../../../modules/messaging/service";

/**
 * M30 — GET /api/v1/vendor/messages/:id. Thin route over the EXISTING
 * messagingService.getForVendor. Verifies: auth, non-vendor rejection,
 * cross-vendor IDOR (404, no enumeration signal), and that a
 * CUSTOMER-participant conversation is invisible via this vendor-only
 * route.
 */
vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function getRequest(id: string) {
  return new Request(`http://localhost/api/v1/vendor/messages/${id}`);
}

describe("GET /api/v1/vendor/messages/:id", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCustomerProfileIds: string[] = [];
  const createdConversationIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversationIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerProfileIds } } });
    await prisma.vendorMembership.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeVendorOwner(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `Vendor Msg Detail ${label}`, storefrontSlug: `vendor-msg-detail-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const owner = await prisma.user.create({ data: { id: `vendor-msg-detail-owner-${label}-${suffix}`, name: `Owner ${label}`, email: `vendor.msg.detail.owner.${label}.${suffix}@example.com` } });
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });
    return { vendor, owner };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(getRequest("x"), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-vendor user", async () => {
    const suffix = `${Date.now()}`;
    const user = await prisma.user.create({ data: { id: `vendor-msg-detail-nonvendor-${suffix}`, name: "Not a vendor", email: `vendor.msg.detail.nonvendor.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
    const response = await GET(getRequest("x"), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(403);
  });

  it("returns the owning vendor's conversation", async () => {
    const a = await makeVendorOwner("owner");
    const started = await messagingService.startVendorConversation(a.vendor.id, a.owner.id, "Vendor A's message");
    if (!started.ok) throw new Error(started.error);
    createdConversationIds.push(started.value.conversationId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(a.owner.id));
    const response = await GET(getRequest(started.value.conversationId), { params: Promise.resolve({ id: started.value.conversationId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.messages[0].body).toBe("Vendor A's message");
  });

  it("returns 404 for another vendor's conversation (IDOR)", async () => {
    const a = await makeVendorOwner("victim");
    const b = await makeVendorOwner("attacker");
    const started = await messagingService.startVendorConversation(a.vendor.id, a.owner.id, "Private to vendor A");
    if (!started.ok) throw new Error(started.error);
    createdConversationIds.push(started.value.conversationId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(b.owner.id));
    const response = await GET(getRequest(started.value.conversationId), { params: Promise.resolve({ id: started.value.conversationId }) });
    expect(response.status).toBe(404);
  });

  it("returns 404 for a CUSTOMER-participant conversation — the vendor route never exposes customer threads", async () => {
    const a = await makeVendorOwner("cross-role");
    const suffix = `${Date.now()}`;
    const customerUser = await prisma.user.create({ data: { id: `vendor-msg-detail-cust-${suffix}`, name: "Customer", email: `vendor.msg.detail.cust.${suffix}@example.com` } });
    createdUserIds.push(customerUser.id);
    const customerProfile = await prisma.customerProfile.create({ data: { userId: customerUser.id, displayName: "Customer" } });
    createdCustomerProfileIds.push(customerProfile.id);

    const customerConversation = await messagingService.startOrContinueContextual({
      customerProfileId: customerProfile.id,
      senderUserId: customerUser.id,
      contextType: "VENDOR",
      contextRefId: a.vendor.id,
      body: "Customer's own message",
    });
    if (!customerConversation.ok) throw new Error(customerConversation.error);
    createdConversationIds.push(customerConversation.value.conversationId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(a.owner.id));
    const response = await GET(getRequest(customerConversation.value.conversationId), { params: Promise.resolve({ id: customerConversation.value.conversationId }) });
    expect(response.status).toBe(404);
  });
});
