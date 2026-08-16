"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, MessagesSquare, PackageSearch } from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/vendor-applications", label: "Vendor applications", icon: ClipboardCheck },
  { href: "/admin/listings", label: "Listings", icon: PackageSearch },
  { href: "/admin/messages", label: "Messages", icon: MessagesSquare },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
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
