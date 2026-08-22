import { headers } from "next/headers";

/**
 * Best-effort client IP for rate-limiting keys (M13; re-verified for
 * Railway in M13.2 — see docs/decisions/0012-railway-deployment-m13-2.md),
 * used by server actions Better Auth doesn't own (lib/rate-limit.ts).
 *
 * Preference order and why:
 * 1. `cf-connecting-ip` — set at Cloudflare's edge, never client-settable.
 *    Only relevant if a custom domain is later proxied through Cloudflare;
 *    a harmless no-op otherwise.
 * 2. `x-real-ip` — Railway's own dedicated single-value client-IP header.
 * 3. `x-forwarded-for`, leftmost entry — per Railway community reports
 *    (not confirmed in Railway's own official docs, same "sourced, flagged
 *    if uncertain" discipline as this codebase's Paystack/Moolre ADRs),
 *    Railway's edge proxy strips/replaces any client-supplied XFF value
 *    rather than merely appending to it (unlike Render, M13's original
 *    target — see ADR 0011's now-superseded analysis for that platform),
 *    so the leftmost entry is trustworthy here without a trustedProxies
 *    CIDR list.
 *
 * Falling back to "unknown" (one shared bucket) when none resolve is a
 * deliberate fail-safe: it can only make rate limiting more conservative,
 * never less. Recommended: once deployed, verify real incoming headers
 * match this understanding (see ADR 0012) — Railway has noted it is
 * actively rolling out new CDN/edge infrastructure, which could change
 * this.
 */
export async function resolveClientIp(): Promise<string> {
  const requestHeaders = await headers();

  const cfConnectingIp = requestHeaders.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const realIp = requestHeaders.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    const leftmost = forwardedFor.split(",")[0]?.trim();
    if (leftmost) return leftmost;
  }

  return "unknown";
}
