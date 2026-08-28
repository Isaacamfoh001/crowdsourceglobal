import { vendorsRepository } from "../vendors/repository";

export type ExplorePostPublisherContext = {
  vendorId: string;
  vendorName: string;
};

/**
 * Resolves whether `userId` may publish Explore posts, and as which Vendor.
 *
 * Publisher eligibility (M21): the smallest existing identity that already
 * carries a public name/logo/location and a real moderation relationship
 * with CrownSource is an approved Vendor — the same identity the Vendor
 * Portal already grants access to. There is no dedicated beauty-
 * professional/service-profile domain yet (the M21 brief is explicit: do
 * not build one prematurely). A future dedicated provider-profile domain
 * can widen ExplorePost's ownership later without dropping this table —
 * see prisma/schema.prisma's ExplorePost doc comment.
 *
 * Mirrors the Vendor Portal's own `getVendorPortalContext` resolution
 * (modules/vendors/policy.ts: first membership found — this codebase does
 * not yet support a multi-vendor "switch membership" UI) but as a plain,
 * non-redirecting lookup suitable for an `/api/v1` route, per
 * docs/architecture/overview.md's "Mobile API Foundation" authorization
 * convention (never the redirect/notFound-throwing page guards).
 *
 * Additionally requires `verificationStatus === "APPROVED"` — defensive
 * belt-and-braces: every Vendor row is already only ever created APPROVED
 * (modules/vendor-applications/service.ts), but this keeps Explore
 * publishing consistent with every other public-vendor-identity read path
 * in this codebase (modules/vendors/repository.ts's public queries all
 * filter on this same condition).
 */
export async function resolveExplorePostPublisher(userId: string): Promise<ExplorePostPublisherContext | null> {
  const membership = await vendorsRepository.findFirstMembershipForUser(userId);
  if (!membership || membership.vendor.verificationStatus !== "APPROVED") return null;
  return { vendorId: membership.vendorId, vendorName: membership.vendor.companyName };
}
