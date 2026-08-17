"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutGrid, MessagesSquare, PackageSearch, Receipt, RotateCcw, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/account", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/account/orders", label: "Orders", icon: Receipt, exact: false },
  { href: "/account/quotes", label: "Quotes", icon: FileText, exact: false },
  { href: "/account/sourcing", label: "Sourcing Requests", icon: PackageSearch, exact: false },
  { href: "/account/resolutions", label: "Returns & Issues", icon: RotateCcw, exact: false },
  { href: "/account/messages", label: "Messages", icon: MessagesSquare, exact: false },
  { href: "/account/profile", label: "Profile", icon: User, exact: true },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "bg-brand-100 text-brand-800" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <item.icon className="size-4" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
