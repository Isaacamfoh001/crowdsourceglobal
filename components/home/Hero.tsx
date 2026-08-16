import Link from "next/link";
import { Layers, PackageSearch, ShoppingBag } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

const mockCards = [
  {
    icon: ShoppingBag,
    label: "Standard purchase",
    detail: "22\" Human Hair Bundle · Vendor A",
  },
  {
    icon: Layers,
    label: "Bulk pricing",
    detail: "500 units → instant quote",
  },
  {
    icon: PackageSearch,
    label: "Custom sourcing",
    detail: "Branded packaging · in review",
  },
];

export function Hero() {
  return (
    <div className="relative overflow-hidden bg-stone-50">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-brand-100),transparent)]"
      />
      <div className="mx-auto grid max-w-7xl gap-16 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-28">
        <div>
          <Badge tone="brand">A managed marketplace</Badge>
          <h1 className="mt-6 text-4xl font-medium tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
            Buy what you need,
            <br />
            however you need it.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
            Shop individual products, unlock instant pricing on bulk orders, or tell us
            what you&apos;re sourcing and we&apos;ll find it. One marketplace, three ways
            to buy — every vendor reviewed before their listings go live.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up">
              <Button size="lg" fullWidth className="sm:w-auto">
                Create your account
              </Button>
            </Link>
            <Link href="/#marketplace">
              <Button size="lg" variant="outline" fullWidth className="sm:w-auto">
                See how buying works
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:mx-0" aria-hidden="true">
          <div className="flex flex-col gap-4">
            {mockCards.map((card, index) => (
              <div
                key={card.label}
                className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-lifted"
                style={{ marginLeft: index % 2 === 1 ? "2rem" : undefined }}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
                  <card.icon className="size-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-display text-[15px] font-medium text-stone-900">
                    {card.label}
                  </p>
                  <p className="text-sm text-stone-500">{card.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
