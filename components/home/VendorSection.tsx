import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";

const benefits = [
  "Reach ordinary and bulk demand in one place, without building your own storefront",
  "CrownSourceGlobal handles buyer-facing conversations tied to your listings and orders",
  "Orders arrive ready to fulfil, with the details you need — not scattered across channels",
  "Get matched to custom sourcing requests — wholesale hair, beauty supplies, and more",
];

/**
 * Light, typography-led business section (M14.4) — replaces the previous
 * dark espresso band + four bordered icon tiles. Homepage dark moments are
 * now deliberately rationed (Hero, CustomSourcing); this is the "warm
 * business story" beat and reads as ivory/espresso like the rest of the
 * page, with the benefit list carried by a simple divided list rather than
 * another card grid.
 */
export function VendorSection() {
  return (
    <section id="sell" className="bg-ivory-50 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">
              Building a beauty business?
            </p>
            <h2 className="mt-3 max-w-md font-display text-3xl font-medium tracking-tight text-espresso-950 sm:text-4xl">
              You focus on selling. We handle what&apos;s around it.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-espresso-900/70">
              List your hair, beauty, or cosmetics products, keep availability and
              pricing accurate, and fulfil the orders that come through. CrownSourceGlobal
              manages buyer communication, structured ordering, and payment collection —
              so you&apos;re not running a full ecommerce operation on your own.
            </p>
            <div className="mt-8">
              <Link href="/sell">
                <Button size="lg">
                  Become a vendor
                  <ArrowRight className="size-4" strokeWidth={2} />
                </Button>
              </Link>
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-ivory-300 border-t border-ivory-300 lg:pt-1">
            {benefits.map((benefit) => (
              <li key={benefit} className="py-5 text-[15px] leading-relaxed text-espresso-900/75 first:pt-0">
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
