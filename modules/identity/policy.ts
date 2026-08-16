import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";

/**
 * Server-side session/authorization helpers. This is the ONLY place
 * "is there a valid session" is checked — pages and route handlers call
 * these rather than re-implementing session lookups, per CLAUDE.md's
 * "authorization is a server-side concern, never UI-only" rule.
 *
 * Better Auth establishes identity; everything below establishes what
 * CrownSourceGlobal considers a valid, usable session for our app.
 */
export async function getCurrentSession() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session;
}

/** For pages/route handlers that must be authenticated. Redirects otherwise. */
export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}
