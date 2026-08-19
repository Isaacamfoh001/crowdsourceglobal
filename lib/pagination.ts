/**
 * (M11.1) Shared server-side pagination convention — standardizing on the
 * skip/take + separate count() shape M11's vendor-finance module already
 * established, rather than inventing a second pattern. See
 * components/shared/Pagination.tsx for the matching UI.
 */
export const DEFAULT_PAGE_SIZE = 20;

/** Never trusts a raw query-string value directly — clamps to a real positive integer. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function paginationSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
