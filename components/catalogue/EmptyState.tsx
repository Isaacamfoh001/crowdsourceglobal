import { PackageSearch } from "lucide-react";

export function EmptyState({
  title = "No listings found",
  description = "Try a different category or search term.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <PackageSearch className="size-6" strokeWidth={1.5} />
      </div>
      <h3 className="font-display text-lg font-medium text-stone-900">{title}</h3>
      <p className="max-w-sm text-sm text-stone-500">{description}</p>
    </div>
  );
}
