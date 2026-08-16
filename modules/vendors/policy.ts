import { cache } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "../identity/policy";
import { vendorsRepository } from "./repository";

/**
 * Next.js-aware, like modules/identity/policy.ts — the Vendor Portal's
 * session/membership guard. A valid Better Auth session only establishes
 * identity; VendorMembership is what actually grants portal access, so
 * every portal page must go through this rather than trusting navigation
 * visibility.
 *
 * M3 does not support switching between multiple vendor memberships for one
 * user — the first membership found is used as "the" portal context. The
 * schema already supports more; a switcher UI is deferred.
 */
export const getVendorPortalContext = cache(async function getVendorPortalContext(userId: string) {
  return vendorsRepository.findFirstMembershipForUser(userId);
});

export async function requireVendorPortalContext(redirectTo?: string) {
  const session = await requireSession(redirectTo);
  const membership = await getVendorPortalContext(session.user.id);
  if (!membership) {
    redirect("/vendor/onboarding");
  }
  return { session, vendorId: membership.vendorId, role: membership.role, vendor: membership.vendor };
}
