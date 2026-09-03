// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";

/**
 * M29.1 — real store-logo upload replacing the old pasted-URL field.
 * Verifies: auth required, non-vendor rejected, a real upload stores a
 * storage key (never trusts a client-supplied URL string), and DELETE
 * clears it. Upload validation itself (mime/size/magic-bytes) is already
 * covered generically by modules/beauty-professionals/image-validation's
 * sibling test pattern — modules/vendors/image-validation.ts mirrors it
 * exactly, so this file focuses on routing/auth/ownership/persistence.
 */
vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { POST, DELETE } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

// A minimal valid 1x1 PNG.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function uploadRequest(logo?: { bytes: Buffer; type: string; name: string }) {
  const form = new FormData();
  if (logo) form.append("logo", new File([new Uint8Array(logo.bytes)], logo.name, { type: logo.type }));
  return new Request("http://localhost/api/v1/vendor/store/logo", { method: "POST", body: form });
}

describe("POST/DELETE /api/v1/vendor/store/logo", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function makeVendorWithOwner(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: `Logo Test ${label} ${suffix}`, storefrontSlug: `m29-logo-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const owner = await prisma.user.create({ data: { id: `m29-logo-${label}-${suffix}`, name: "Owner", email: `m29.logo.${label}.${suffix}@example.com` } });
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });
    return { vendorId: vendor.id, ownerUserId: owner.id };
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const res = await POST(uploadRequest({ bytes: PNG_BYTES, type: "image/png", name: "logo.png" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated user with no vendor membership", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `m29-logo-nomember-${suffix}`, name: "No Vendor", email: `m29.logo.nomember.${suffix}@example.com` } });
    createdUserIds.push(user.id);

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user.id));
    const res = await POST(uploadRequest({ bytes: PNG_BYTES, type: "image/png", name: "logo.png" }));
    expect(res.status).toBe(403);
  });

  it("rejects an upload with no file part", async () => {
    const { ownerUserId } = await makeVendorWithOwner("nofile");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUserId));
    const res = await POST(uploadRequest());
    expect(res.status).toBe(422);
  });

  it("uploads a real logo, storing a storage key (never a client-supplied URL), then removes it", async () => {
    const { vendorId, ownerUserId } = await makeVendorWithOwner("happy");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUserId));

    const uploadRes = await POST(uploadRequest({ bytes: PNG_BYTES, type: "image/png", name: "logo.png" }));
    expect(uploadRes.status).toBe(200);

    const stored = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { logoUrl: true } });
    expect(stored?.logoUrl).toMatch(/^vendor-logo-images\//);

    const removeRes = await DELETE();
    expect(removeRes.status).toBe(200);
    const afterRemove = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { logoUrl: true } });
    expect(afterRemove?.logoUrl).toBeNull();
  });
});
