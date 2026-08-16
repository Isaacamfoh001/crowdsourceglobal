import { prisma } from "../../lib/db";
import type { CustomerProfile } from "../../generated/prisma/client";

/**
 * Data access for CustomerProfile. Framework-agnostic — no Next.js or
 * Better Auth imports here (see docs/architecture/overview.md's module
 * boundary rule).
 */
export const identityRepository = {
  createCustomerProfile(input: {
    userId: string;
    displayName: string;
  }): Promise<CustomerProfile> {
    return prisma.customerProfile.create({
      data: {
        userId: input.userId,
        displayName: input.displayName,
      },
    });
  },

  findCustomerProfileByUserId(userId: string): Promise<CustomerProfile | null> {
    return prisma.customerProfile.findUnique({
      where: { userId },
    });
  },
};
