import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({
  items,
  dark = false,
}: {
  items: { label: string; href?: string }[];
  /** For placement over a dark cover band (e.g. the vendor storefront header) instead of the default light background. */
  dark?: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb" className={`text-sm ${dark ? "text-ivory-200/60" : "text-espresso-900/55"}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {index > 0 ? (
              <ChevronRight className={`size-3.5 ${dark ? "text-ivory-200/30" : "text-espresso-900/25"}`} />
            ) : null}
            {item.href ? (
              <Link href={item.href} className={dark ? "hover:text-ivory-50" : "hover:text-espresso-950"}>
                {item.label}
              </Link>
            ) : (
              <span className={dark ? "text-ivory-50" : "text-espresso-950"}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
