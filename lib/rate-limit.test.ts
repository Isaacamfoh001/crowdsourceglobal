import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { checkActionRateLimit } from "./rate-limit";

/** Integration test against the real local Postgres dev database, matching this codebase's convention (e.g. modules/payments/*.test.ts) — no in-memory substitute, since the whole point of this limiter is that it's DB-backed. */
describe("checkActionRateLimit", () => {
  const keysToClean: string[] = [];

  afterEach(async () => {
    if (keysToClean.length > 0) {
      await prisma.actionRateLimit.deleteMany({ where: { key: { in: keysToClean } } });
      keysToClean.length = 0;
    }
  });

  function freshKey(): string {
    const key = `test:${randomUUID()}`;
    keysToClean.push(key);
    return key;
  }

  it("allows requests under the limit", async () => {
    const key = freshKey();
    const rule = { windowSeconds: 60, max: 3 };
    expect(await checkActionRateLimit(key, rule)).toEqual({ allowed: true });
    expect(await checkActionRateLimit(key, rule)).toEqual({ allowed: true });
    expect(await checkActionRateLimit(key, rule)).toEqual({ allowed: true });
  });

  it("denies once the limit is exceeded within the window, with a positive retryAfterSeconds", async () => {
    const key = freshKey();
    const rule = { windowSeconds: 60, max: 2 };
    expect(await checkActionRateLimit(key, rule)).toEqual({ allowed: true });
    expect(await checkActionRateLimit(key, rule)).toEqual({ allowed: true });

    const third = await checkActionRateLimit(key, rule);
    expect(third.allowed).toBe(false);
    if (!third.allowed) {
      expect(third.retryAfterSeconds).toBeGreaterThan(0);
      expect(third.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("different keys (different users/accounts) never share a limit", async () => {
    const keyA = freshKey();
    const keyB = freshKey();
    const rule = { windowSeconds: 60, max: 1 };

    expect(await checkActionRateLimit(keyA, rule)).toEqual({ allowed: true });
    expect((await checkActionRateLimit(keyA, rule)).allowed).toBe(false);

    // keyB has never been used — must still be allowed even though keyA is exhausted.
    expect(await checkActionRateLimit(keyB, rule)).toEqual({ allowed: true });
  });

  it("resets once the window elapses, and normal flow continues afterward", async () => {
    const key = freshKey();
    const rule = { windowSeconds: 1, max: 2 };

    expect(await checkActionRateLimit(key, rule)).toEqual({ allowed: true });
    expect(await checkActionRateLimit(key, rule)).toEqual({ allowed: true });
    expect((await checkActionRateLimit(key, rule)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(await checkActionRateLimit(key, rule)).toEqual({ allowed: true });
    expect(await checkActionRateLimit(key, rule)).toEqual({ allowed: true });
  });

  it("never allows more than max concurrent requests for the same key", async () => {
    const key = freshKey();
    const rule = { windowSeconds: 60, max: 3 };

    const results = await Promise.all(Array.from({ length: 6 }, () => checkActionRateLimit(key, rule)));
    const allowedCount = results.filter((result) => result.allowed).length;

    expect(allowedCount).toBe(3);
  });
});
