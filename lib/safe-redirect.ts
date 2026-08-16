/**
 * Only ever follow a same-origin, path-relative redirect (never `//host`,
 * which browsers treat as protocol-relative to an external origin). Used
 * everywhere a `?redirect=` query param feeds back into a client-side
 * navigation after authentication.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/account"): string {
  if (target && target.startsWith("/") && !target.startsWith("//")) {
    return target;
  }
  return fallback;
}
