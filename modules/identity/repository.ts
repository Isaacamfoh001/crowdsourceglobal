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

  /** M32.3 — Experience Mode UI preference only; never an authorization write. */
  async updatePreferredExperience(userId: string, preferredExperience: string | null): Promise<CustomerProfile | null> {
    const result = await prisma.customerProfile.updateMany({
      where: { userId },
      data: { preferredExperience },
    });
    if (result.count === 0) return null;
    return this.findCustomerProfileByUserId(userId);
  },
};
