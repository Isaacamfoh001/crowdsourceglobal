import Link from "next/link";
import {
  ArrowRight,
  Handshake,
  MessagesSquare,
  PackageCheck,
  Radar,
  Wallet,
} from "lucide-react";
import { Section } from "../../../components/ui/Section";
import { Container } from "../../../components/ui/Container";
import { SectionHeading } from "../../../components/ui/SectionHeading";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";

export const metadata = {
  title: "Sell on CrownSourceGlobal",
  description:
    "Vendor onboarding for businesses and suppliers who want to sell through CrownSourceGlobal.",
};

const benefits = [
  {
    icon: Radar,
    title: "Exposure to buyers",
    description:
      "Reach ordinary and bulk demand in one place, without building your own storefront.",
  },
  {
    icon: MessagesSquare,
    title: "Managed buyer communication",
    description:
      "CrownSourceGlobal handles buyer-facing conversations tied to your listings and orders.",
  },
  {
    icon: PackageCheck,
    title: "Structured ordering",
    description:
      "Orders arrive ready to fulfil, with the details you need — not scattered across channels.",
  },
  {
    icon: Handshake,
    title: "Sourcing opportunities",
    description:
      "Get matched to custom sourcing requests that fit what you already supply.",
  },
  {
    icon: Wallet,
    title: "Managed payment collection",
    description:
      "CrownSourceGlobal collects customer payment, so you're not chasing invoices yourself.",
  },
];

export default function SellPage() {
  return (
    <>
      <div className="bg-ivory-50 pt-16 pb-8 sm:pt-20 lg:pt-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="gold">For businesses & suppliers</Badge>
            <h1 className="mt-6 font-display text-4xl font-medium tracking-tight text-espresso-950 sm:text-5xl">
              Sell through CrownSourceGlobal
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-espresso-900/65">
              If you supply products and want an easier channel to reach buyers — from
              individual purchases to bulk orders — vendor onboarding starts here. Vendor
              accounts go through a separate review process from ordinary customer
              accounts, so we can keep the marketplace trustworthy for buyers.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/vendor/onboarding">
                <Button size="lg" fullWidth className="sm:w-auto">
                  Begin vendor onboarding
                  <ArrowRight className="size-4" strokeWidth={2} />
                </Button>
              </Link>
              <Link href="/sign-in?redirect=/vendor/onboarding">
                <Button variant="outline" size="lg" fullWidth className="sm:w-auto">
                  Already started? Sign in
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </div>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Why sell here"
          title="You focus on selling. We handle what's around it."
          subtitle="List your products, keep availability and pricing accurate, and fulfil the orders that come through — CrownSourceGlobal manages the commerce around it."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-ivory-300 bg-ivory-50 p-7"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-champagne-200 text-forest-900">
                <benefit.icon className="size-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 font-display text-lg font-medium text-espresso-950">
                {benefit.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-espresso-900/65">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="default">
        <div className="mx-auto max-w-2xl">
          <SectionHeading eyebrow="What to expect" title="Onboarding is a separate process" />
          <ol className="mt-10 flex flex-col gap-8">
            <li className="flex gap-4">
              <span className="font-display text-2xl font-medium text-champagne-400/70">01</span>
              <div>
                <h3 className="font-display text-base font-medium text-espresso-950">
                  Create or sign in to your account
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-espresso-900/65">
                  The same CrownSourceGlobal account you&apos;d use to buy — one identity,
                  whichever way you use the marketplace.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-display text-2xl font-medium text-champagne-400/70">02</span>
              <div>
                <h3 className="font-display text-base font-medium text-espresso-950">
                  Tell us about your business
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-espresso-900/65">
                  Vendor onboarding — including business verification and listing setup —
                  is being built as our next milestone.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-display text-2xl font-medium text-champagne-400/70">03</span>
              <div>
                <h3 className="font-display text-base font-medium text-espresso-950">
                  Get reviewed, then start listing
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-espresso-900/65">
                  Our team reviews vendor applications before listings go live on the
                  marketplace.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </Section>
    </>
  );
}
