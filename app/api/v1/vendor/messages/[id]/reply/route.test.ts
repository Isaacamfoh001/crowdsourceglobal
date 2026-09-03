// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../../lib/db";
import { messagingService } from "../../../../../../../modules/messaging/service";

/**
 * M30 — POST /api/v1/vendor/messages/:id/reply. Thin route over the
 * EXISTING messagingService.replyAsVendor, which re-verifies vendor
 * ownership before appending. Verifies: auth, non-vendor rejection,
 * cross-vendor IDOR, and a real reply persisting.
 */
vi.mock("../../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function replyRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/v1/vendor/messages/${id}/reply`, { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/v1/vendor/messages/:id/reply", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdConversationIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversationIds } } });
    await prisma.vendorMembership.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeVendorOwner(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `Vendor Msg Reply ${label}`, storefrontSlug: `vendor-msg-reply-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const owner = await prisma.user.create({ data: { id: `vendor-msg-reply-owner-${label}-${suffix}`, name: `Owner ${label}`, email: `vendor.msg.reply.owner.${label}.${suffix}@example.com` } });
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });
    return { vendor, owner };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(replyRequest("x", { body: "hi" }), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-vendor user", async () => {
    const suffix = `${Date.now()}`;
    const user = await prisma.user.create({ data: { id: `vendor-msg-reply-nonvendor-${suffix}`, name: "Not a vendor", email: `vendor.msg.reply.nonvendor.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
    const response = await POST(replyRequest("x", { body: "hi" }), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(403);
  });

  it("rejects a reply into another vendor's conversation (IDOR) — no message is persisted", async () => {
    const a = await makeVendorOwner("victim");
    const b = await makeVendorOwner("attacker");
    const started = await messagingService.startVendorConversation(a.vendor.id, a.owner.id, "Vendor A opening message");
    if (!started.ok) throw new Error(started.error);
    createdConversationIds.push(started.value.conversationId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(b.owner.id));
    const response = await POST(replyRequest(started.value.conversationId, { body: "Vendor B trying to post" }), { params: Promise.resolve({ id: started.value.conversationId }) });
    expect(response.status).toBe(422);

    const detail = await messagingService.getForVendor(a.vendor.id, started.value.conversationId);
    expect(detail?.messages).toHaveLength(1);
  });

  it("posts a real reply as the owning vendor", async () => {
    const a = await makeVendorOwner("owner");
    const started = await messagingService.startVendorConversation(a.vendor.id, a.owner.id, "Opening");
    if (!started.ok) throw new Error(started.error);
    createdConversationIds.push(started.value.conversationId);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(a.owner.id));
    const response = await POST(replyRequest(started.value.conversationId, { body: "Following up" }), { params: Promise.resolve({ id: started.value.conversationId }) });
    expect(response.status).toBe(200);

    const detail = await messagingService.getForVendor(a.vendor.id, started.value.conversationId);
    expect(detail?.messages).toHaveLength(2);
  });
});
