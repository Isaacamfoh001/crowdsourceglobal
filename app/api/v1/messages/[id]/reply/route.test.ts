// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";
import { messagingService } from "../../../../../../modules/messaging/service";

/**
 * M30 — POST /api/v1/messages/:id/reply. Thin route over the EXISTING
 * messagingService.replyAsCustomer, which re-verifies ownership before
 * appending. Verifies: auth, cross-customer IDOR (the same
 * VALIDATION_ERROR-on-forged-ownership convention already established by
 * POST /api/v1/quotations/:id/accept), and a real reply persisting.
 */
vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function replyRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/v1/messages/${id}/reply`, { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/v1/messages/:id/reply", () => {
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
    const user = await prisma.user.create({ data: { id: `msg-api-reply-${label}-${suffix}`, name: `Msg Reply ${label}`, email: `msg.reply.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Msg Reply ${label}` } });
    createdCustomerProfileIds.push(profile.id);
    return { user, profile };
  }

  async function makeVendor(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `Msg Reply Vendor ${label}`, storefrontSlug: `msg-reply-vendor-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    return vendor;
  }

  async function makeConversation(label: string) {
    const { user, profile } = await makeCustomer(label);
    const vendor = await makeVendor(label);
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: profile.id,
      senderUserId: user.id,
      contextType: "VENDOR",
      contextRefId: vendor.id,
      body: "Opening message",
    });
    if (!created.ok) throw new Error(created.error);
    createdConversationIds.push(created.value.conversationId);
    return { user, profile, conversationId: created.value.conversationId };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(replyRequest("x", { body: "hi" }), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("rejects an empty body", async () => {
    const convo = await makeConversation("empty");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(convo.user.id));
    const response = await POST(replyRequest(convo.conversationId, { body: "   " }), { params: Promise.resolve({ id: convo.conversationId }) });
    expect(response.status).toBe(422);
  });

  it("rejects a reply into another customer's conversation (IDOR) — no message is persisted", async () => {
    const convo = await makeConversation("victim");
    const attacker = await makeCustomer("attacker");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(attacker.user.id));
    const response = await POST(replyRequest(convo.conversationId, { body: "Attacker trying to post" }), { params: Promise.resolve({ id: convo.conversationId }) });
    expect(response.status).toBe(422);

    const detail = await messagingService.getForCustomer(convo.profile.id, convo.conversationId);
    expect(detail?.messages).toHaveLength(1);
  });

  it("posts a real reply as the owning customer", async () => {
    const convo = await makeConversation("owner");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(convo.user.id));

    const response = await POST(replyRequest(convo.conversationId, { body: "Following up" }), { params: Promise.resolve({ id: convo.conversationId }) });
    expect(response.status).toBe(200);

    const detail = await messagingService.getForCustomer(convo.profile.id, convo.conversationId);
    expect(detail?.messages).toHaveLength(2);
    expect(detail?.messages[1]?.body).toBe("Following up");
  });
});
