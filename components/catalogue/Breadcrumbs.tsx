import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {index > 0 ? <ChevronRight className="size-3.5 text-stone-300" /> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-stone-900">
                {item.label}
              </Link>
            ) : (
              <span className="text-stone-900">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
