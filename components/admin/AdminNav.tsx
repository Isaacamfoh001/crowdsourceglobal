"use client";

import { AlertCircle, ClipboardCheck, CreditCard, FileText, LayoutDashboard, MessagesSquare, PackageSearch, RotateCcw, Search, Truck, Wallet } from "lucide-react";
import { ShellNav, type ShellNavItem } from "../ui/ShellNav";

const NAV_ITEMS: ShellNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, group: "Overview" },
  { href: "/admin/attention", label: "Attention required", icon: AlertCircle, group: "Overview" },
  { href: "/admin/vendor-applications", label: "Vendor applications", icon: ClipboardCheck, group: "Moderation" },
  { href: "/admin/listings", label: "Listings", icon: PackageSearch, group: "Moderation" },
  { href: "/admin/sourcing", label: "Sourcing", icon: Search, group: "Commerce" },
  { href: "/admin/quotations", label: "Quotations", icon: FileText, group: "Commerce" },
  { href: "/admin/operations", label: "Operations", icon: Truck, group: "Commerce" },
  { href: "/admin/resolutions", label: "Resolutions", icon: RotateCcw, group: "Commerce" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, group: "Finance" },
  { href: "/admin/finance", label: "Finance", icon: Wallet, group: "Finance" },
  { href: "/admin/messages", label: "Messages", icon: MessagesSquare, group: "Support" },
];

export function AdminNav() {
  return <ShellNav items={NAV_ITEMS} tone="neutral" />;
}
