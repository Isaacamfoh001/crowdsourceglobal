"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "../ui/Button";
import { SignOutButton } from "../auth/SignOutButton";
import { NotificationBell } from "../notifications/NotificationBell";
import type { NotificationView } from "../../modules/notifications/types";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/sourcing", label: "Source" },
  { href: "/sell", label: "Sell" },
];

function CartLink({ itemCount }: { itemCount: number }) {
  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      className="relative flex size-10 items-center justify-center rounded-lg text-espresso-800 transition-colors hover:bg-ivory-100"
    >
      <ShoppingBag className="size-5" strokeWidth={1.75} />
      {itemCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-espresso-800 text-[10px] font-semibold text-ivory-50">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}

export function SiteHeader({
  isSignedIn,
  cartItemCount,
  hasVendorPortal = false,
  isAdmin = false,
  unreadNotificationCount = 0,
  recentNotifications = [],
}: {
  isSignedIn: boolean;
  cartItemCount: number;
  hasVendorPortal?: boolean;
  isAdmin?: boolean;
  unreadNotificationCount?: number;
  recentNotifications?: NotificationView[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ivory-300/80 bg-ivory-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8 lg:py-4">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-espresso-800/75 transition-colors hover:text-espresso-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {isSignedIn ? (
            <>
              {hasVendorPortal ? (
                <Link
                  href="/vendor/portal"
                  className="text-sm font-medium text-espresso-800 transition-colors hover:text-espresso-950"
                >
                  Vendor Portal
                </Link>
              ) : null}
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-champagne-700 transition-colors hover:text-champagne-600"
                >
                  Admin
                </Link>
              ) : null}
              <CartLink itemCount={cartItemCount} />
              <NotificationBell unreadCount={unreadNotificationCount} recent={recentNotifications} />
              <Link
                href="/account"
                className="text-sm font-medium text-espresso-800 transition-colors hover:text-espresso-950"
              >
                Account
              </Link>
              <SignOutButton size="sm" />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-espresso-800 transition-colors hover:text-espresso-950"
              >
                Sign in
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Create account</Button>
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          {isSignedIn ? <CartLink itemCount={cartItemCount} /> : null}
          {isSignedIn ? <NotificationBell unreadCount={unreadNotificationCount} recent={recentNotifications} /> : null}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex size-10 items-center justify-center rounded-lg text-espresso-800 hover:bg-ivory-100"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-nav"
          className="border-t border-ivory-300 bg-ivory-50 px-4 py-4 sm:px-6 lg:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3.5 py-3 text-[15px] font-medium text-espresso-800 hover:bg-ivory-100"
              >
                {link.label}
              </Link>
            ))}
            {isSignedIn ? (
              <>
                {hasVendorPortal ? (
                  <Link
                    href="/vendor/portal"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3.5 py-3 text-[15px] font-medium text-espresso-800 hover:bg-ivory-100"
                  >
                    Vendor Portal
                  </Link>
                ) : null}
                {isAdmin ? (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3.5 py-3 text-[15px] font-medium text-champagne-700 hover:bg-champagne-200/40"
                  >
                    Admin
                  </Link>
                ) : null}
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3.5 py-3 text-[15px] font-medium text-espresso-800 hover:bg-ivory-100"
                >
                  Account
                </Link>
              </>
            ) : null}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-ivory-300 pt-4">
            {isSignedIn ? (
              <SignOutButton fullWidth />
            ) : (
              <>
                <Link href="/sign-in" onClick={() => setMenuOpen(false)}>
                  <Button variant="outline" fullWidth>
                    Sign in
                  </Button>
                </Link>
                <Link href="/sign-up" onClick={() => setMenuOpen(false)}>
                  <Button fullWidth>Create account</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
