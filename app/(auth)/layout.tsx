import Link from "next/link";
import { ArrowLeft, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Logo } from "../../components/layout/Logo";

const reassurances = [
  { icon: ShieldCheck, text: "Vendors are reviewed before their listings go live." },
  { icon: Users, text: "One account for shopping, bulk orders, and custom requests." },
  { icon: Sparkles, text: "Clear pricing and order tracking, start to finish." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — full experience on desktop, compact band on mobile */}
      <div className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-forest-950 px-6 py-6 lg:w-[42%] lg:px-14 lg:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 hidden bg-[radial-gradient(80%_60%_at_20%_10%,var(--color-forest-900),transparent)] lg:block"
        />
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-champagne-300 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to marketplace
          </Link>
          <Logo onDark className="lg:hidden" />
        </div>

        <div className="mt-10 hidden lg:block">
          <Logo onDark className="mb-8" />
          <h2 className="font-display text-3xl font-medium leading-snug text-white">
            One account. Every way to buy.
          </h2>
          <ul className="mt-8 flex flex-col gap-5">
            {reassurances.map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-ivory-50/10 text-champagne-400">
                  <item.icon className="size-4" strokeWidth={1.75} />
                </div>
                <p className="text-[15px] leading-relaxed text-champagne-200/90">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-sm text-champagne-200/50 lg:block">
          © {new Date().getFullYear()} CrownSourceGlobal
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-ivory-50 px-6 py-12 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
