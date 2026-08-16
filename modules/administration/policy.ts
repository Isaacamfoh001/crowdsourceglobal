import { cache } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "../identity/policy";
import { administrationRepository } from "./repository";

export type AdminRole = "SUPER_ADMIN" | "OPS_ADMIN" | "FINANCE_ADMIN";

/**
 * Next.js-aware admin session guard. An AdminUser row — created only via the
 * dev-only `npm run admin:grant` script (see scripts/grant-admin.ts) — is
 * the only thing that grants access here; there is no role field on User
 * itself and no route that can self-elevate a session into one.
 *
 * A signed-in non-admin gets `notFound()` rather than a redirect that would
 * confirm an admin surface exists at this URL — an unauthenticated visitor
 * still gets the normal sign-in redirect via requireSession.
 */
export const getAdminContext = cache(async function getAdminContext(userId: string) {
  return administrationRepository.findAdminUserByUserId(userId);
});

export async function requireAdminSession(redirectTo?: string, allowedRoles?: AdminRole[]) {
  const session = await requireSession(redirectTo);
  const admin = await getAdminContext(session.user.id);
  if (!admin || (allowedRoles && !allowedRoles.includes(admin.role))) {
    notFound();
  }
  return { session, admin };
}
