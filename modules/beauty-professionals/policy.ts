import { vendorsRepository } from "../vendors/repository";

export type BeautyProfessionalOwnerContext = {
  vendorId: string;
  vendorName: string;
};

/**
 * Resolves whether `userId` may create/manage a BeautyProfessionalProfile,
 * and as which Vendor — same eligibility as Explore publishing
 * (modules/explore-posts/policy.ts's resolveExplorePostPublisher): the
 * caller's first VendorMembership, requiring the underlying Vendor is
 * already `verificationStatus: APPROVED`. This is only the "may apply" gate
 * — becoming a PUBLIC Beauty Professional additionally requires this
 * profile itself to reach `status: APPROVED` (see
 * prisma/schema.prisma's BeautyProfessionalProfile doc comment for why that
 * is a separate decision from Vendor approval).
 */
export async function resolveBeautyProfessionalOwner(userId: string): Promise<BeautyProfessionalOwnerContext | null> {
  const membership = await vendorsRepository.findFirstMembershipForUser(userId);
  if (!membership || membership.vendor.verificationStatus !== "APPROVED") return null;
  return { vendorId: membership.vendorId, vendorName: membership.vendor.companyName };
}
