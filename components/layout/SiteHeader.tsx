"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "../ui/Button";

const NAV_LINKS = [
  { href: "/#marketplace", label: "Shop" },
  { href: "/#custom-sourcing", label: "Custom Sourcing" },
  { href: "/sell", label: "Sell with Us" },
  { href: "/#how-it-works", label: "How It Works" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-stone-700 transition-colors hover:text-stone-900"
          >
            Sign in
          </Link>
          <Link href="/sign-up">
            <Button size="sm">Create account</Button>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="flex size-10 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 lg:hidden"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen ? (
        <div
          id="mobile-nav"
          className="border-t border-stone-200 bg-stone-50 px-6 py-4 lg:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-stone-700 hover:bg-stone-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-stone-200 pt-4">
            <Link href="/sign-in" onClick={() => setMenuOpen(false)}>
              <Button variant="outline" fullWidth>
                Sign in
              </Button>
            </Link>
            <Link href="/sign-up" onClick={() => setMenuOpen(false)}>
              <Button fullWidth>Create account</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
