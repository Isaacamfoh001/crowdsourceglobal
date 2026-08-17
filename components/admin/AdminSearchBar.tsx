"use client";

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/**
 * A plain GET form to a server-rendered results page — no client-side
 * fetch/SPA behavior, consistent with the rest of the admin app.
 */
export function AdminSearchBar({ onDark = false }: { onDark?: boolean }) {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";

  return (
    <form action="/admin/search" method="GET" role="search" className="relative w-full max-w-xs">
      <label htmlFor="admin-search-q" className="sr-only">
        Search orders, quotes, sourcing requests, vendors, customers, listings, tracking references
      </label>
      <Search
        className={`pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 ${onDark ? "text-stone-400" : "text-stone-400"}`}
        strokeWidth={1.75}
      />
      <input
        id="admin-search-q"
        type="search"
        name="q"
        defaultValue={currentQuery}
        placeholder="Search orders, vendors, customers…"
        className={`w-full rounded-lg py-2 pr-3 pl-9 text-sm outline-none ${
          onDark
            ? "border border-white/15 bg-white/10 text-white placeholder:text-stone-400 focus:border-white/30"
            : "border border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        }`}
      />
    </form>
  );
}
