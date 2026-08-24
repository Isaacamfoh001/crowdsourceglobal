"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export type ShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Optional group label — rendered as a heading above the first item of a new group, desktop only. */
  group?: string;
};

/**
 * Shared shell sidebar navigation (M14.4) — the horizontal-scroll-on-mobile
 * / vertical-sidebar-on-desktop pattern used identically by the customer
 * account, vendor portal, and admin shells. The active state is a left
 * accent rule plus weight change, not a filled pill — a solid champagne (or
 * any solid) chip repeated down every sidebar, on every page load, reads as
 * decoration rather than wayfinding. `tone` only changes the accent color:
 * "brand" (forest) for commerce-forward surfaces (account, vendor),
 * "neutral" (ivory) for the denser admin operations console.
 */
export function ShellNav({
  items,
  tone = "brand",
}: {
  items: ShellNavItem[];
  tone?: "brand" | "neutral";
}) {
  const pathname = usePathname();
  const activeClasses =
    tone === "brand"
      ? "text-forest-900 font-semibold lg:border-l-forest-800 lg:bg-ivory-100"
      : "text-espresso-950 font-semibold lg:border-l-espresso-800 lg:bg-ivory-100";

  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0" aria-label="Section">
      {items.map((item, index) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const showGroupHeading = Boolean(item.group) && item.group !== items[index - 1]?.group;

        return (
          <div key={item.href} className="contents lg:block">
            {showGroupHeading ? (
              <p className="hidden px-3.5 pt-4 pb-1 text-xs font-semibold tracking-wide text-espresso-900/40 uppercase first:pt-1 lg:block">
                {item.group}
              </p>
            ) : null}
            <Link
              href={item.href}
              className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-full border border-transparent px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors lg:rounded-none lg:border-l-2 lg:pl-3 ${
                isActive
                  ? `bg-ivory-100 ${activeClasses}`
                  : "text-espresso-800/70 hover:bg-ivory-100 lg:border-transparent"
              }`}
            >
              <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
