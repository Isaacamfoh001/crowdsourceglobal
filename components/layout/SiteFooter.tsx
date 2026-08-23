import Link from "next/link";
import { Logo } from "./Logo";

const marketplaceLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/#custom-sourcing", label: "Custom sourcing" },
  { href: "/#how-it-works", label: "How it works" },
];

const vendorLinks = [
  { href: "/sell", label: "Become a vendor" },
  { href: "/sign-in?redirect=/vendor/onboarding", label: "Continue onboarding" },
];

const accountLinks = [
  { href: "/sign-up", label: "Create account" },
  { href: "/sign-in", label: "Sign in" },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="text-sm text-ivory-200/55 transition-colors hover:text-ivory-50">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-espresso-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 sm:gap-10">
          <div className="col-span-2 sm:col-span-1">
            <Logo onDark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory-200/55">
              A managed marketplace connecting buyers with approved vendors — for single
              purchases, bulk orders, and custom sourcing.
            </p>
          </div>
          <FooterColumn title="Marketplace" links={marketplaceLinks} />
          <FooterColumn title="For vendors" links={vendorLinks} />
          <FooterColumn title="Account" links={accountLinks} />
        </div>

        <div className="mt-12 border-t border-espresso-800 pt-8">
          <p className="text-sm text-ivory-200/35">
            © {new Date().getFullYear()} CrownSourceGlobal. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
