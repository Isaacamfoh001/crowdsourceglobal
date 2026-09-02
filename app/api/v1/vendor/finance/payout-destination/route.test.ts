// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../../lib/db";

/**
 * M27 — payout destination is OWNER-only (M27 §21: "Never expose sensitive
 * full account information unnecessarily" / CLAUDE.md §12: never trust UI
 * hiding for an authorization decision). The enforcement itself lives in
 * vendorFinanceService.upsertPayoutDestinationForVendor (untouched by this
 * milestone); this test proves the new PATCH route actually passes the
 * caller's real membership role through rather than trusting a client-
 * supplied one, by using a real STAFF membership and confirming a real
 * OWNER-only rejection comes back over the wire.
 */
vi.mock("../../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { PATCH } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(userId: string): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, name: userId, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: `s-${userId}`, token: `t-${userId}`, userId, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/v1/vendor/finance/payout-destination", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/v1/vendor/finance/payout-destination", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.vendorPayoutDestination.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it("rejects a STAFF member's attempt to change the payout destination", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: "Staff Test Co", storefrontSlug: `m27-payout-staff-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const staffUser = await prisma.user.create({ data: { id: `m27-staff-${suffix}`, name: "Staff", email: `m27.staff.${suffix}@example.com` } });
    createdUserIds.push(staffUser.id);
    await prisma.vendorMembership.create({ data: { userId: staffUser.id, vendorId: vendor.id, role: "STAFF" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(staffUser.id));

    const response = await PATCH(
      patchRequest({ type: "MOBILE_MONEY", momoAccountName: "Staff Attempt", momoPhone: "0244000000", momoNetwork: "MTN" }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toMatch(/owner/i);

    const stored = await prisma.vendorPayoutDestination.findUnique({ where: { vendorId: vendor.id } });
    expect(stored).toBeNull();
  });

  it("allows an OWNER to set the payout destination", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: { companyName: "Owner Test Co", storefrontSlug: `m27-payout-owner-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" },
    });
    createdVendorIds.push(vendor.id);
    const ownerUser = await prisma.user.create({ data: { id: `m27-owner-${suffix}`, name: "Owner", email: `m27.owner.${suffix}@example.com` } });
    createdUserIds.push(ownerUser.id);
    await prisma.vendorMembership.create({ data: { userId: ownerUser.id, vendorId: vendor.id, role: "OWNER" } });

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(ownerUser.id));

    const response = await PATCH(
      patchRequest({ type: "MOBILE_MONEY", momoAccountName: "Owner Real Name", momoPhone: "0244123456", momoNetwork: "MTN" }),
    );

    expect(response.status).toBe(200);
    const stored = await prisma.vendorPayoutDestination.findUnique({ where: { vendorId: vendor.id } });
    expect(stored?.momoAccountName).toBe("Owner Real Name");
  });
});
