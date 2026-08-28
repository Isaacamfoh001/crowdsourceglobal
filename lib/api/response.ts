import { NextResponse } from "next/server";
import { Prisma } from "../../generated/prisma/client";

/**
 * Shared response conventions for every `/api/v1/*` route (M18.1). This is
 * deliberately small — a handful of pure functions, not a framework. See
 * `docs/architecture/overview.md`'s "Mobile API Foundation" section for the
 * full convention this codifies.
 *
 * Route handlers still call the existing `modules/*` services directly —
 * this file only shapes what a route hands back over HTTP. It must never
 * grow business logic of its own.
 */

/**
 * Stable, machine-readable error codes a mobile/native client can branch
 * on without parsing `message` (which is a safe, human-readable string,
 * never a stack trace or raw provider/Prisma error).
 */
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/** `{ "data": ... }` — every successful /api/v1 response, never a bare array/object. */
export function apiSuccess<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

/**
 * `{ "error": { "code", "message" } }` — the one error shape every
 * `/api/v1` route returns, whether the failure is auth, authorization,
 * validation, or "not found". HTTP status is derived from `code` so a
 * route can't accidentally return a 200 with an error body or a 401 with
 * the wrong code.
 */
export function apiError(code: ApiErrorCode, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: STATUS_BY_CODE[code] });
}

/**
 * Money is always `{ amount: "<fixed 2dp string>", currency }` — never a
 * JS float. Accepts what Prisma actually returns for a `Decimal` column
 * (`Prisma.Decimal`) as well as a plain number/string for callers assembling
 * a value manually.
 */
export function serializeMoney(amount: Prisma.Decimal | number | string, currency: string): { amount: string; currency: string } {
  const decimal = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
  return { amount: decimal.toFixed(2), currency };
}

/** ISO-8601 string — the one date wire format across every /api/v1 response. */
export function serializeDate(date: Date): string {
  return date.toISOString();
}

/**
 * `{ page, pageSize, total, totalPages, rows }` — wraps whatever
 * `lib/pagination.ts`'s existing `skip`/`take` + `count()` convention
 * already produced. Does not change that convention, only how it's shaped
 * for a JSON response (an RSC page renders the same rows/total directly;
 * an API response needs an explicit envelope). `totalPages` is derived,
 * never stored — a client that already has `total`/`pageSize` could
 * compute it, but every list is a natural fit so it's provided directly
 * (M18.2, this function's first real caller).
 */
export function apiPage<T>(params: { rows: T[]; total: number; page: number; pageSize: number }) {
  const totalPages = params.pageSize > 0 ? Math.max(1, Math.ceil(params.total / params.pageSize)) : 1;
  return { page: params.page, pageSize: params.pageSize, total: params.total, totalPages, rows: params.rows };
}
