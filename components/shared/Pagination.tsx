import Link from "next/link";

/**
 * (M11.1) One shared pagination control for every growing list page — see
 * lib/pagination.ts. Preserves whatever filter query params the page
 * already has (pass them via `extraParams`); only `page` changes between
 * links. Renders nothing when everything already fits on one page.
 */
export function Pagination({
  currentPage,
  pageSize,
  total,
  basePath,
  extraParams,
}: {
  currentPage: number;
  pageSize: number;
  total: number;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
}) {
  if (total <= pageSize) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildHref(page: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extraParams ?? {})) {
      if (value) params.set(key, value);
    }
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-center gap-4 py-2">
      {currentPage > 1 ? (
        <Link href={buildHref(currentPage - 1)} className="text-sm font-medium text-brand-700 hover:underline">
          ← Previous
        </Link>
      ) : (
        <span className="text-sm text-stone-300">← Previous</span>
      )}
      <span className="text-sm text-stone-500">
        Page {currentPage} of {totalPages}
      </span>
      {currentPage < totalPages ? (
        <Link href={buildHref(currentPage + 1)} className="text-sm font-medium text-brand-700 hover:underline">
          Next →
        </Link>
      ) : (
        <span className="text-sm text-stone-300">Next →</span>
      )}
    </div>
  );
}
