// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";

/**
 * M30 — GET/POST /api/v1/messages. Thin routes over the EXISTING
 * messagingService.listForCustomer / startOrContinueContextual — no new
 * business logic. Verifies: auth, own-conversations-only listing, and that
 * a forged/nonexistent contextRefId is rejected rather than silently
 * creating a conversation about something the caller doesn't own or that
 * doesn't exist (CLAUDE.md's "never trust client-provided ownership"
 * concern — the same validation `messagingService.startOrContinueContextual`
 * already performs for web).
 */
vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
import { GET, POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/v1/messages", { method: "POST", body: JSON.stringify(body) });
}

describe("/api/v1/messages", () => {
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
    const user = await prisma.user.create({ data: { id: `msg-api-cust-${label}-${suffix}`, name: `Msg API ${label}`, email: `msg.api.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Msg API ${label}` } });
    createdCustomerProfileIds.push(profile.id);
    return { user, profile };
  }

  async function makeVendor(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `Msg API Vendor ${label}`, storefrontSlug: `msg-api-vendor-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    return vendor;
  }

  describe("GET", () => {
    it("returns 401 when signed out", async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(null);
      const response = await GET(new Request("http://localhost/api/v1/messages"));
      expect(response.status).toBe(401);
    });

    it("returns only the signed-in customer's own conversations, paginated", async () => {
      const { user, profile } = await makeCustomer("list");
      const other = await makeCustomer("list-other");
      const vendor = await makeVendor("list");

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
      const started = await POST(postRequest({ contextType: "VENDOR", contextRefId: vendor.id, body: "Do you ship to Kumasi?" }));
      expect(started.status).toBe(200);
      const startedBody = await started.json();
      createdConversationIds.push(startedBody.data.conversationId);

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(other.user.id));
      const otherResponse = await GET(new Request("http://localhost/api/v1/messages"));
      const otherBody = await otherResponse.json();
      expect(otherBody.data.rows).toHaveLength(0);

      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
      const mineResponse = await GET(new Request("http://localhost/api/v1/messages"));
      const mineBody = await mineResponse.json();
      expect(mineBody.data.rows).toHaveLength(1);
      expect(mineBody.data.rows[0].id).toBe(startedBody.data.conversationId);
      expect(mineBody.data.rows[0].lastMessage).toBe("Do you ship to Kumasi?");
    });
  });

  describe("POST", () => {
    it("returns 401 when signed out", async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(null);
      const response = await POST(postRequest({ contextType: "VENDOR", contextRefId: "x", body: "hi" }));
      expect(response.status).toBe(401);
    });

    it("rejects an invalid contextType before touching the messaging service", async () => {
      const { user } = await makeCustomer("bad-type");
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
      const response = await POST(postRequest({ contextType: "ADMIN", contextRefId: "x", body: "hi" }));
      expect(response.status).toBe(422);
    });

    it("rejects a forged/nonexistent vendor contextRefId — no conversation is created", async () => {
      const { user } = await makeCustomer("forged");
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
      const response = await POST(postRequest({ contextType: "VENDOR", contextRefId: "does-not-exist", body: "Probing a fake vendor id." }));
      expect(response.status).toBe(422);

      const list = await GET(new Request("http://localhost/api/v1/messages"));
      const listBody = await list.json();
      expect(listBody.data.rows).toHaveLength(0);
    });

    it("starts a real contextual conversation and returns its id", async () => {
      const { user } = await makeCustomer("start");
      const vendor = await makeVendor("start");
      vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));

      const response = await POST(postRequest({ contextType: "VENDOR", contextRefId: vendor.id, body: "Ask about vendor" }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.conversationId).toEqual(expect.any(String));
      createdConversationIds.push(body.data.conversationId);
    });
  });
});
