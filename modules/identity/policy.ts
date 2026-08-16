import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { identityService } from "./service";

/**
 * Server-side session/authorization helpers. This is the ONLY place
 * "is there a valid session" is checked — pages and route handlers call
 * these rather than re-implementing session lookups, per CLAUDE.md's
 * "authorization is a server-side concern, never UI-only" rule.
 *
 * Better Auth establishes identity; everything below establishes what
 * CrownSourceGlobal considers a valid, usable session for our app.
 *
 * Wrapped in React's `cache()` — a request-scoped memoization primitive,
 * not an infrastructure cache — so that the public layout (which needs the
 * session for the header) and a page rendered inside it (which needs the
 * session again for its own auth check) share one lookup per request
 * instead of hitting Better Auth's session store twice.
 */
export const getCurrentSession = cache(async function getCurrentSession() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session;
});

/**
 * Same request-scoped dedup for the CustomerProfile lookup that follows a
 * session check — several (public) pages (cart, checkout, payment) resolve
 * their own CustomerProfile after the layout already resolved it once for
 * the cart-count badge.
 */
export const getCurrentCustomerProfile = cache(async function getCurrentCustomerProfile(
  userId: string,
) {
  return identityService.getCustomerProfileByUserId(userId);
});

/**
 * For pages/route handlers that must be authenticated. Redirects otherwise.
 *
 * `redirectTo` is the path to return to after sign-in (e.g. a page reached
 * via a vendor-entry CTA) — passed through to /sign-in as a query param so
 * the shared sign-in flow can send the user back to where they were headed
 * instead of always landing on /account.
 */
export async function requireSession(redirectTo?: string) {
  const session = await getCurrentSession();
  if (!session) {
    const target = redirectTo
      ? `/sign-in?redirect=${encodeURIComponent(redirectTo)}`
      : "/sign-in";
    redirect(target);
  }
  return session;
}
