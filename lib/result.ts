/**
 * Shared result type for commerce mutations. Server Actions return this
 * instead of throwing, so pages/forms can render a specific message rather
 * than a generic error boundary — every checkout/cart/payment mutation in
 * modules/{cart,orders,payments} uses this shape.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error };
}
