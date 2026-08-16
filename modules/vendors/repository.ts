import { prisma } from "../../lib/db";
import type { PublicVendorProfile, VendorStoreProfile } from "./types";

/**
 * `contactEmail`/`contactPhone` are deliberately excluded from this select —
 * this is the public storefront read path (CLAUDE.md's "no contact bypass"
 * rule). See VendorStoreProfile for the private, vendor-portal-only shape.
 */
const publicVendorSelect = {
  id: true,
  companyName: true,
  description: true,
  storefrontSlug: true,
  sellerType: true,
  logoUrl: true,
  country: true,
  region: true,
  city: true,
  categorySlugs: true,
} as const;

const storeProfileSelect = {
  id: true,
  companyName: true,
  description: true,
  storefrontSlug: true,
  sellerType: true,
  logoUrl: true,
  country: true,
  region: true,
  city: true,
  categorySlugs: true,
  contactEmail: true,
  contactPhone: true,
  leadTimeDaysDefault: true,
} as const;

export const vendorsRepository = {
  findPublicVendorBySlug(slug: string): Promise<PublicVendorProfile | null> {
    return prisma.vendor.findFirst({
      where: { storefrontSlug: slug, verificationStatus: "APPROVED" },
      select: publicVendorSelect,
    });
  },

  findPublicVendorById(vendorId: string): Promise<PublicVendorProfile | null> {
    return prisma.vendor.findFirst({
      where: { id: vendorId, verificationStatus: "APPROVED" },
      select: publicVendorSelect,
    });
  },

  /** First membership found for a user — see modules/vendors/policy.ts. */
  findFirstMembershipForUser(userId: string) {
    return prisma.vendorMembership.findFirst({
      where: { userId },
      select: {
        role: true,
        vendorId: true,
        vendor: { select: { id: true, companyName: true, storefrontSlug: true, verificationStatus: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  isMember(userId: string, vendorId: string): Promise<boolean> {
    return prisma.vendorMembership
      .findUnique({ where: { userId_vendorId: { userId, vendorId } } })
      .then((row) => row !== null);
  },

  findStoreProfile(vendorId: string): Promise<VendorStoreProfile | null> {
    return prisma.vendor.findUnique({ where: { id: vendorId }, select: storeProfileSelect });
  },

  /** Where listing/application moderation notifications for this vendor go. */
  async findOwnerEmail(vendorId: string): Promise<string | null> {
    const membership = await prisma.vendorMembership.findFirst({
      where: { vendorId, role: "OWNER" },
      select: { user: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return membership?.user.email ?? null;
  },

  updateStoreProfile(vendorId: string, data: Record<string, unknown>): Promise<VendorStoreProfile> {
    return prisma.vendor.update({ where: { id: vendorId }, data, select: storeProfileSelect });
  },
};
