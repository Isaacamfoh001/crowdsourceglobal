"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutGrid, MessagesSquare, Package, Settings, Store } from "lucide-react";

const NAV_ITEMS = [
  { href: "/vendor/portal", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/vendor/portal/listings", label: "Listings", icon: Package, exact: false },
  { href: "/vendor/portal/orders", label: "Orders", icon: ClipboardList, exact: false },
  { href: "/vendor/portal/store", label: "Store profile", icon: Store, exact: true },
  { href: "/vendor/portal/messages", label: "Messages", icon: MessagesSquare, exact: false },
  { href: "/vendor/portal/settings", label: "Settings", icon: Settings, exact: true },
];

export function PortalNav() {
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
