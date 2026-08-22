import { headers } from "next/headers";

/**
 * Best-effort client IP for rate-limiting keys (M13), used by server
 * actions Better Auth doesn't own (lib/rate-limit.ts). Render sits behind
 * Cloudflare, so this prefers `cf-connecting-ip` — set at Cloudflare's edge
 * and not client-spoofable — over `x-forwarded-for`.
 *
 * `x-forwarded-for` is deliberately trusted only when it is a single value.
 * Render is documented to APPEND to, not replace, any pre-existing
 * X-Forwarded-For value a client sends — so a multi-value header here could
 * have an attacker-supplied entry ahead of the real client IP, and this
 * code has no verified way to know how many trusted hops precede the app to
 * strip correctly. Falling back to "unknown" (one shared bucket) in that
 * case is a deliberate fail-safe: it can only make rate limiting more
 * conservative, never less. See
 * docs/decisions/0011-production-infrastructure-m13.md for the full
 * reasoning and the manual verification step required once deployed.
 */
export async function resolveClientIp(): Promise<string> {
  const requestHeaders = await headers();

  const cfConnectingIp = requestHeaders.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 1 && parts[0]) return parts[0];
  }

  return "unknown";
}
