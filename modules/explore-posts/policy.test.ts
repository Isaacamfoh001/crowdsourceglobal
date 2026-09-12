import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { resolveExplorePostPublisher } from "./policy";

/**
 * M32.10 — Explore is a Beauty-professional authoring surface, not a
 * general vendor one. Regression coverage for the bug where any approved
 * Vendor membership (an ordinary Seller, a Factory/Manufacturer) could
 * publish to Explore regardless of Beauty Professional access.
 */
describe("resolveExplorePostPublisher", () => {
  let vendorId: string;
  let userId: string;
  const createdVendorIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendor = await prisma.vendor.create({
      data: { companyName: "Explore Policy Test Vendor", storefrontSlug: `explore-policy-test-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorId = vendor.id;
    createdVendorIds.push(vendor.id);

    const user = await prisma.user.create({
      data: { id: `explore-policy-user-${suffix}`, name: "Explore Policy User", email: `explore.policy.user.${suffix}@example.com` },
    });
    userId = user.id;
    createdUserIds.push(user.id);

    await prisma.vendorMembership.create({ data: { userId, vendorId, role: "OWNER" } });
  });

  afterAll(async () => {
    await prisma.beautyProfessionalProfile.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendorMembership.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  it("rejects an approved vendor with no Beauty Professional profile at all", async () => {
    const publisher = await resolveExplorePostPublisher(userId);
    expect(publisher).toBeNull();
  });

  it("rejects an approved vendor whose Beauty Professional profile is still PENDING", async () => {
    await prisma.beautyProfessionalProfile.create({
      data: { vendorId, status: "PENDING", displayName: "Test Pro", bio: "Bio", specialtyCategorySlugs: [], locationMode: "PROVIDER_LOCATION" },
    });
    const publisher = await resolveExplorePostPublisher(userId);
    expect(publisher).toBeNull();
  });

  it("allows an approved vendor with an APPROVED Beauty Professional profile", async () => {
    await prisma.beautyProfessionalProfile.create({
      data: { vendorId, status: "APPROVED", displayName: "Test Pro", bio: "Bio", specialtyCategorySlugs: [], locationMode: "PROVIDER_LOCATION" },
    });
    const publisher = await resolveExplorePostPublisher(userId);
    expect(publisher).not.toBeNull();
    expect(publisher?.vendorId).toBe(vendorId);
  });
});
