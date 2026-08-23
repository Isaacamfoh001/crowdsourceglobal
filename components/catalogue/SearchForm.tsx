import { Search } from "lucide-react";

/**
 * Server-renderable GET form — no client JS required. Submitting navigates
 * to the same route with `?q=` set, which the page reads server-side.
 */
export function SearchForm({ action, defaultValue }: { action: string; defaultValue?: string }) {
  return (
    <form action={action} method="get" role="search" className="relative">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-espresso-950/40"
        strokeWidth={2}
      />
      <label htmlFor="q" className="sr-only">
        Search listings
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search listings…"
        className="w-full rounded-full border border-ivory-400 bg-ivory-50 py-3 pl-11 pr-4 text-[15px] text-espresso-950 outline-none transition-colors placeholder:text-espresso-950/40 focus:border-champagne-400 focus:ring-2 focus:ring-champagne-200"
      />
    </form>
  );
}
