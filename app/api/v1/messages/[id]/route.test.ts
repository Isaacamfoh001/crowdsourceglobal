// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";
import { messagingService } from "../../../../../modules/messaging/service";

/**
 * M30 — GET /api/v1/messages/:id. Thin route over the EXISTING
 * messagingService.getForCustomer (already customer-scoped). Verifies:
 * auth, cross-customer IDOR (404, not 403 — no enumeration signal), and
 * that a VENDOR-participant conversation is invisible via this
 * customer-only route.
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
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function getRequest(id: string) {
  return new Request(`http://localhost/api/v1/messages/${id}`);
}

describe("GET /api/v1/messages/:id", () => {
  const createdUserIds: string[] = [];
  const createdCustomerProfileIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdConversationIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversationIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerProfileIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeCustomer(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `msg-api-detail-${label}-${suffix}`, name: `Msg Detail ${label}`, email: `msg.detail.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Msg Detail ${label}` } });
    createdCustomerProfileIds.push(profile.id);
    return { user, profile };
  }

  async function makeVendor(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `Msg Detail Vendor ${label}`, storefrontSlug: `msg-detail-vendor-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    return vendor;
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(getRequest("x"), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("returns the owning customer's conversation with chronological messages", async () => {
    const { user, profile } = await makeCustomer("owner");
    const vendor = await makeVendor("owner");
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: profile.id,
      senderUserId: user.id,
      contextType: "VENDOR",
      contextRefId: vendor.id,
      body: "First message",
    });
    if (!created.ok) throw new Error(created.error);
    createdConversationIds.push(created.value.conversationId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
    const response = await GET(getRequest(created.value.conversationId), { params: Promise.resolve({ id: created.value.conversationId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.messages).toHaveLength(1);
    expect(body.data.messages[0].body).toBe("First message");
    expect(body.data.messages[0].senderIsStaff).toBe(false);
  });

  it("returns 404 for another customer's conversation (IDOR)", async () => {
    const owner = await makeCustomer("victim");
    const attacker = await makeCustomer("attacker");
    const vendor = await makeVendor("idor");
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: owner.profile.id,
      senderUserId: owner.user.id,
      contextType: "VENDOR",
      contextRefId: vendor.id,
      body: "Private",
    });
    if (!created.ok) throw new Error(created.error);
    createdConversationIds.push(created.value.conversationId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(attacker.user.id));
    const response = await GET(getRequest(created.value.conversationId), { params: Promise.resolve({ id: created.value.conversationId }) });
    expect(response.status).toBe(404);
  });

  it("returns 404 for a VENDOR-participant conversation — the customer route never exposes vendor threads", async () => {
    const { user } = await makeCustomer("cross-role");
    const vendor = await makeVendor("cross-role");
    const vendorOwner = await prisma.user.create({ data: { id: `msg-api-vowner-${Date.now()}`, name: "Vendor Owner", email: `msg.vowner.${Date.now()}@example.com` } });
    createdUserIds.push(vendorOwner.id);

    const vendorConversation = await messagingService.startVendorConversation(vendor.id, vendorOwner.id, "Vendor's own message");
    if (!vendorConversation.ok) throw new Error(vendorConversation.error);
    createdConversationIds.push(vendorConversation.value.conversationId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
    const response = await GET(getRequest(vendorConversation.value.conversationId), { params: Promise.resolve({ id: vendorConversation.value.conversationId }) });
    expect(response.status).toBe(404);
  });
});
