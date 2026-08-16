import { Search } from "lucide-react";

/**
 * Server-renderable GET form — no client JS required. Submitting navigates
 * to the same route with `?q=` set, which the page reads server-side.
 */
export function SearchForm({ action, defaultValue }: { action: string; defaultValue?: string }) {
  return (
    <form action={action} method="get" role="search" className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400"
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
        className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-10 pr-3.5 text-[15px] text-stone-900 shadow-soft outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
    </form>
  );
}
