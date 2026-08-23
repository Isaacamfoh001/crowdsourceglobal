import Link from "next/link";
import { ArrowRight, Handshake, MessagesSquare, PackageCheck, Radar } from "lucide-react";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";

const benefits = [
  {
    icon: Radar,
    title: "Exposure to buyers",
    description: "Reach ordinary and bulk demand in one place, without building your own storefront.",
  },
  {
    icon: MessagesSquare,
    title: "Managed buyer communication",
    description: "CrownSourceGlobal handles buyer-facing conversations tied to your listings and orders.",
  },
  {
    icon: PackageCheck,
    title: "Structured ordering",
    description: "Orders arrive ready to fulfil, with the details you need — not scattered across channels.",
  },
  {
    icon: Handshake,
    title: "Sourcing opportunities",
    description: "Get matched to custom sourcing requests that fit what you already supply.",
  },
];

export function VendorSection() {
  return (
    <section id="sell" className="bg-espresso-900 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-champagne-300 uppercase">For vendors</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
              You focus on selling. We handle what&apos;s around it.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ivory-200/70">
              List your products, keep availability and pricing accurate, and fulfil the
              orders that come through. CrownSourceGlobal manages buyer communication,
              structured ordering, and payment collection — so you&apos;re not running a
              full ecommerce operation on your own.
            </p>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link href="/sell">
                <Button
                  size="lg"
                  fullWidth
                  className="!bg-champagne-400 !text-espresso-950 hover:!bg-champagne-300 sm:w-auto"
                >
                  Become a Vendor
                  <ArrowRight className="size-4" strokeWidth={2} />
                </Button>
              </Link>
              <p className="text-sm text-ivory-200/50">
                See what&apos;s involved and how onboarding works.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="border border-white/10 p-6">
                <benefit.icon className="size-6 text-champagne-400" strokeWidth={1.25} />
                <h3 className="mt-4 font-display text-base font-medium text-ivory-50">
                  {benefit.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ivory-200/60">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
