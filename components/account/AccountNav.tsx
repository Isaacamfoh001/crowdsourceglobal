"use client";

import { FileText, LayoutGrid, MapPin, MessagesSquare, PackageSearch, Receipt, RotateCcw, Sparkles, User } from "lucide-react";
import { ShellNav, type ShellNavItem } from "../ui/ShellNav";

const NAV_ITEMS: ShellNavItem[] = [
  { href: "/account", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/account/orders", label: "Orders", icon: Receipt, exact: false },
  { href: "/account/quotes", label: "Quotes", icon: FileText, exact: false },
  { href: "/account/sourcing", label: "Sourcing Requests", icon: PackageSearch, exact: false },
  { href: "/account/service-requests", label: "Service Requests", icon: Sparkles, exact: false },
  { href: "/account/resolutions", label: "Returns & Issues", icon: RotateCcw, exact: false },
  { href: "/account/addresses", label: "Addresses", icon: MapPin, exact: false },
  { href: "/account/messages", label: "Messages", icon: MessagesSquare, exact: false },
  { href: "/account/profile", label: "Profile", icon: User, exact: true },
];

export function AccountNav() {
  return <ShellNav items={NAV_ITEMS} tone="brand" />;
}
