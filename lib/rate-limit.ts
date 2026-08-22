import { prisma } from "./db";

export type RateLimitRule = { windowSeconds: number; max: number };
export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** Shown to end users on a 429 — never infrastructure terminology (M13 brief). */
export const RATE_LIMIT_MESSAGE = "Too many attempts. Please try again shortly.";

/**
 * Fixed-window, Postgres-backed rate limiter for server actions Better
 * Auth's own database-backed limiter (lib/auth.ts) doesn't cover — payment/
 * OTP initiation, checkout order creation. Deliberately not in-memory: a
 * single Render web-service process restarting (deploys, crashes) would
 * otherwise silently reset every limit to zero, which is exactly the
 * "misleading protection" the M13 brief asked to avoid. No Redis — one
 * Postgres table (ActionRateLimit), the same guarded-write idiom this
 * codebase already uses for EmailDeliveryJob claiming
 * (modules/notifications/repository.ts). See
 * docs/decisions/0011-production-infrastructure-m13.md.
 *
 * Concurrency: each branch below is a single guarded UPDATE/INSERT: a
 * losing concurrent caller never observes a stale read, it just falls
 * through to the next branch and re-checks against the row's real
 * (now-committed) state. Two concurrent requests for the same key can
 * therefore never both "win" past `max`.
 */
export async function checkActionRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
  const now = new Date();
  const windowStartCutoff = new Date(now.getTime() - rule.windowSeconds * 1000);

  // 1. An existing row whose window has expired — reset it to a fresh window.
  const reset = await prisma.actionRateLimit.updateMany({
    where: { key, windowStart: { lt: windowStartCutoff } },
    data: { count: 1, windowStart: now },
  });
  if (reset.count === 1) return { allowed: true };

  // 2. No row yet for this key — create one. A concurrent caller creating
  // the same key loses to the unique constraint and falls through to (3).
  try {
    await prisma.actionRateLimit.create({ data: { key, count: 1, windowStart: now } });
    return { allowed: true };
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
  }

  // 3. Row exists and its window is still current — increment only if still
  // under the limit, guarded so concurrent callers can't all "win" past max.
  const incremented = await prisma.actionRateLimit.updateMany({
    where: { key, windowStart: { gte: windowStartCutoff }, count: { lt: rule.max } },
    data: { count: { increment: 1 } },
  });
  if (incremented.count === 1) return { allowed: true };

  const row = await prisma.actionRateLimit.findUnique({ where: { key } });
  const retryAfterSeconds = row
    ? Math.max(1, Math.ceil((row.windowStart.getTime() + rule.windowSeconds * 1000 - now.getTime()) / 1000))
    : rule.windowSeconds;
  return { allowed: false, retryAfterSeconds };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
