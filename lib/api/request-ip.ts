/**
 * Same header-preference logic as ../request-ip.ts's resolveClientIp, but
 * reads directly off a Route Handler's own `Request` instead of
 * `next/headers`'s `headers()` — that helper requires Next's request-scope
 * async storage, which a Route Handler's `Request` doesn't need and which
 * makes it untestable by calling a route's exported handler directly (see
 * app/api/v1/talent-applications/route.ts, the first place this pattern
 * was established).
 */
export function resolveIpFromRequest(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const leftmost = forwardedFor.split(",")[0]?.trim();
    if (leftmost) return leftmost;
  }

  return "unknown";
}
