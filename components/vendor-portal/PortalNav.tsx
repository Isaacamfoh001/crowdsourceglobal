"use client";

import { ClipboardList, Compass, LayoutGrid, MessagesSquare, Package, RotateCcw, Settings, Store, Wallet } from "lucide-react";
import { ShellNav, type ShellNavItem } from "../ui/ShellNav";

const NAV_ITEMS: ShellNavItem[] = [
  { href: "/vendor/portal", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/vendor/portal/listings", label: "Listings", icon: Package, exact: false },
  { href: "/vendor/portal/explore", label: "Explore", icon: Compass, exact: false },
  { href: "/vendor/portal/orders", label: "Orders", icon: ClipboardList, exact: false },
  { href: "/vendor/portal/finance", label: "Finance", icon: Wallet, exact: false },
  { href: "/vendor/portal/resolutions", label: "Issues", icon: RotateCcw, exact: false },
  { href: "/vendor/portal/store", label: "Store profile", icon: Store, exact: true },
  { href: "/vendor/portal/messages", label: "Messages", icon: MessagesSquare, exact: false },
  { href: "/vendor/portal/settings", label: "Settings", icon: Settings, exact: true },
];

export function PortalNav() {
  return <ShellNav items={NAV_ITEMS} tone="brand" />;
}
