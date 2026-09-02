import { vendorsService } from "../../modules/vendors/service";

/**
 * M27 — the `/api/v1/vendor/*` equivalent of `modules/vendors/policy.ts`'s
 * `requireVendorPortalContext`, but non-redirecting (see
 * `app/api/v1/me/route.ts`'s doc comment on why every `/api/v1` route
 * resolves identity itself instead of reusing the web-only, `redirect()`-
 * throwing policy helpers). A `VendorMembership` row only ever exists once
 * `vendorApplicationsService.approve()` has created both the `Vendor`
 * (with `verificationStatus: "APPROVED"`) and the membership in the same
 * transaction — so, exactly like the web portal guard, finding a
 * membership here already implies an approved, live vendor; no separate
 * verification-status check is needed.
 *
 * M3's "no multi-vendor switcher" limitation applies here too — this
 * resolves the first membership only, same as the web portal.
 */
export async function resolveVendorContext(userId: string) {
  const membership = await vendorsService.getFirstMembershipForUser(userId);
  if (!membership) return null;
  return { vendorId: membership.vendorId, role: membership.role, vendor: membership.vendor };
}
