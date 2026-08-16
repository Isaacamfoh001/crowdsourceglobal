import { prisma } from "../../lib/db";
import type { PublicVendorProfile } from "./types";

const publicVendorSelect = {
  id: true,
  companyName: true,
  description: true,
  storefrontSlug: true,
} as const;

export const vendorsRepository = {
  findPublicVendorBySlug(slug: string): Promise<PublicVendorProfile | null> {
    return prisma.vendor.findFirst({
      where: { storefrontSlug: slug, verificationStatus: "APPROVED" },
      select: publicVendorSelect,
    });
  },
};
