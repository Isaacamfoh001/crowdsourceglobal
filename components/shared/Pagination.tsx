import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

  const navClasses = "flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-colors";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 py-2 sm:justify-center">
      {currentPage > 1 ? (
        <Link href={buildHref(currentPage - 1)} aria-label="Previous page" className={`${navClasses} text-forest-800 hover:bg-ivory-200`}>
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </Link>
      ) : (
        <span aria-hidden="true" className={`${navClasses} text-espresso-900/25`}>
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </span>
      )}
      <span className="text-sm text-espresso-900/55 tabular-nums">
        Page {currentPage} of {totalPages}
      </span>
      {currentPage < totalPages ? (
        <Link href={buildHref(currentPage + 1)} aria-label="Next page" className={`${navClasses} text-forest-800 hover:bg-ivory-200`}>
          <ChevronRight className="size-5" strokeWidth={1.75} />
        </Link>
      ) : (
        <span aria-hidden="true" className={`${navClasses} text-espresso-900/25`}>
          <ChevronRight className="size-5" strokeWidth={1.75} />
        </span>
      )}
    </nav>
  );
}
