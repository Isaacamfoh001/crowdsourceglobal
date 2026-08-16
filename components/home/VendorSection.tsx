import Link from "next/link";
import { ArrowRight, Handshake, MessagesSquare, PackageCheck, Radar } from "lucide-react";
import { Section } from "../ui/Section";
import { SectionHeading } from "../ui/SectionHeading";
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
    <Section id="sell" tone="brand">
      <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="For vendors"
            title="You focus on selling. We handle what's around it."
            subtitle="List your products, keep availability and pricing accurate, and fulfil the orders that come through. CrownSourceGlobal manages buyer communication, structured ordering, and payment collection — so you're not running a full ecommerce operation on your own."
            onDark
          />
          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link href="/sell">
              <Button variant="secondary" size="lg" fullWidth className="sm:w-auto">
                Become a Vendor
                <ArrowRight className="size-4" strokeWidth={2} />
              </Button>
            </Link>
            <p className="text-sm text-brand-200">
              See what&apos;s involved and how onboarding works.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-white/10 text-gold-300">
                <benefit.icon className="size-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 font-display text-base font-medium text-white">
                {benefit.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-100/80">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
