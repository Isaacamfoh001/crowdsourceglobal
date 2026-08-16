import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { vendorsService } from "./service";

/** Integration tests against the real local Postgres dev database. */
describe("vendorsService — membership", () => {
  let vendorAId: string;
  let vendorBId: string;
  let ownerUserId: string;
  let outsiderUserId: string;
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendorA = await prisma.vendor.create({
      data: { companyName: "Membership Test Vendor A", storefrontSlug: `membership-test-a-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorAId = vendorA.id;
    createdVendorIds.push(vendorA.id);

    const vendorB = await prisma.vendor.create({
      data: { companyName: "Membership Test Vendor B", storefrontSlug: `membership-test-b-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorBId = vendorB.id;
    createdVendorIds.push(vendorB.id);

    const owner = await prisma.user.create({
      data: { id: `membership-owner-${suffix}`, name: "Owner", email: `membership.owner.${suffix}@example.com` },
    });
    ownerUserId = owner.id;
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendorAId, role: "OWNER" } });
    // Also a customer — proves buyer + vendor capabilities coexist on one User.
    await prisma.customerProfile.create({ data: { userId: owner.id, displayName: "Owner" } });

    const outsider = await prisma.user.create({
      data: { id: `membership-outsider-${suffix}`, name: "Outsider", email: `membership.outsider.${suffix}@example.com` },
    });
    outsiderUserId = outsider.id;
    createdUserIds.push(outsider.id);
  });

  afterAll(async () => {
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.vendorMembership.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it("gives the approved owner access to their vendor", async () => {
    const membership = await vendorsService.getFirstMembershipForUser(ownerUserId);
    expect(membership?.vendorId).toBe(vendorAId);
    expect(membership?.role).toBe("OWNER");
    expect(await vendorsService.isMember(ownerUserId, vendorAId)).toBe(true);
  });

  it("denies an unauthorized user access to any vendor", async () => {
    const membership = await vendorsService.getFirstMembershipForUser(outsiderUserId);
    expect(membership).toBeNull();
    expect(await vendorsService.isMember(outsiderUserId, vendorAId)).toBe(false);
  });

  it("a vendor member cannot access a vendor they don't belong to", async () => {
    expect(await vendorsService.isMember(ownerUserId, vendorBId)).toBe(false);
  });

  it("a User can hold both a CustomerProfile and a VendorMembership simultaneously", async () => {
    const customerProfile = await prisma.customerProfile.findUnique({ where: { userId: ownerUserId } });
    const membership = await vendorsService.getFirstMembershipForUser(ownerUserId);
    expect(customerProfile).not.toBeNull();
    expect(membership).not.toBeNull();
  });

  it("never exposes private contact fields in the public storefront profile", async () => {
    await vendorsService.updateStoreProfile(vendorAId, {
      companyName: "Membership Test Vendor A",
      categorySlugs: [],
      contactEmail: "private@example.com",
      contactPhone: "0200000000",
    });

    const storefront = await prisma.vendor.findFirst({ where: { id: vendorAId } });
    expect(storefront?.contactEmail).toBe("private@example.com"); // stored, for CrownSource ops

    // But the actual public repository select never includes it:
    const { vendorsRepository } = await import("./repository");
    const publicProfile = await vendorsRepository.findPublicVendorById(vendorAId);
    expect(publicProfile).not.toBeNull();
    expect(JSON.stringify(publicProfile)).not.toContain("private@example.com");
  });
});
