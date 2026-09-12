import { vendorsRepository } from "../vendors/repository";
import { beautyProfessionalsRepository } from "../beauty-professionals/repository";

export type ExplorePostPublisherContext = {
  vendorId: string;
  vendorName: string;
};

/**
 * Resolves whether `userId` may publish Explore posts, and as which Vendor.
 *
 * M32.10 — Explore is a Beauty-professional authoring surface, not a
 * general vendor one: an ordinary Seller or a Factory/Manufacturer without
 * Beauty Professional access must not be able to post, even though they
 * hold an otherwise-APPROVED Vendor membership (the identity Explore posts
 * are attributed to — see prisma/schema.prisma's ExplorePost doc comment).
 * This mirrors the mobile client's own gate (`isEligibleExploreProvider`,
 * which reads `GET /api/v1/me`'s `beautyProfessional.available`) — that
 * client check is a UI affordance only; this is the real authorization
 * boundary, re-verified independently on every mutating request per
 * CLAUDE.md's "never trust UI hiding" rule.
 *
 * Mirrors the Vendor Portal's own `getVendorPortalContext` resolution
 * (modules/vendors/policy.ts: first membership found — this codebase does
 * not yet support a multi-vendor "switch membership" UI) but as a plain,
 * non-redirecting lookup suitable for an `/api/v1` route, per
 * docs/architecture/overview.md's "Mobile API Foundation" authorization
 * convention (never the redirect/notFound-throwing page guards).
 */
export async function resolveExplorePostPublisher(userId: string): Promise<ExplorePostPublisherContext | null> {
  const membership = await vendorsRepository.findFirstMembershipForUser(userId);
  if (!membership || membership.vendor.verificationStatus !== "APPROVED") return null;

  const beautyProfile = await beautyProfessionalsRepository.findForVendor(membership.vendorId);
  if (beautyProfile?.status !== "APPROVED") return null;

  return { vendorId: membership.vendorId, vendorName: membership.vendor.companyName };
}
