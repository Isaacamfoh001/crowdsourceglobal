import { getCurrentSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { vendorsService } from "../../../../modules/vendors/service";
import { vendorApplicationsService } from "../../../../modules/vendor-applications/service";
import { apiSuccess, apiError } from "../../../../lib/api/response";

/**
 * GET /api/v1/me — the first `/api/v1` endpoint (M18.1) and the reference
 * implementation every later mobile route should copy.
 *
 * Authorization convention: this route calls only the existing
 * NON-redirecting identity primitives (`getCurrentSession`,
 * `getCurrentCustomerProfile`, and the plain data-returning
 * `vendorsService`/`vendorApplicationsService` lookups below) — never
 * `requireSession`/`requireVendorPortalContext`/`requireAdminSession`
 * (`modules/identity`, `modules/vendors`, `modules/administration`
 * policy.ts), which throw Next.js `redirect()`/`notFound()` and exist
 * purely for pages/Server Actions. Those web-oriented helpers are
 * untouched by M18.1 and must stay that way — every `/api/v1` route
 * instead resolves identity itself and returns a real 401/403/404 JSON
 * body, exactly as this route does below. See
 * `docs/architecture/overview.md`'s "Mobile API Foundation" section.
 *
 * Business-logic-free by design: every field below is read directly from
 * an existing service (`identityService` via the policy helper,
 * `vendorsService`, `vendorApplicationsService`) — this route only shapes
 * the response, it does not decide anything.
 */
export async function GET(_request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Authentication required.");
  }

  const [customerProfile, vendorMemberships, vendorApplication] = await Promise.all([
    getCurrentCustomerProfile(session.user.id),
    vendorsService.listMembershipsForUser(session.user.id),
    vendorApplicationsService.getForUser(session.user.id),
  ]);

  return apiSuccess({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
    },
    customer: customerProfile ? { id: customerProfile.id } : null,
    vendor: {
      available: vendorMemberships.length > 0,
      memberships: vendorMemberships.map((membership) => ({
        vendorId: membership.vendorId,
        role: membership.role,
        companyName: membership.vendor.companyName,
        verificationStatus: membership.vendor.verificationStatus,
      })),
    },
    vendorApplication: vendorApplication
      ? { id: vendorApplication.id, status: vendorApplication.status }
      : null,
  });
}
