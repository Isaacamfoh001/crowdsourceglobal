import Link from "next/link";
import { PackageSearch, type LucideIcon } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({
  icon: Icon = PackageSearch,
  title = "No listings found",
  description = "Try a different category or search term.",
  actionHref,
  actionLabel,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ivory-400 bg-ivory-100 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ivory-200 text-espresso-900/40">
        <Icon className="size-6" strokeWidth={1.5} />
      </div>
      <h3 className="font-display text-lg font-medium text-espresso-950">{title}</h3>
      <p className="max-w-sm text-sm text-espresso-900/60">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="mt-1">
          <Button variant="outline" size="sm">
            {actionLabel}
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
