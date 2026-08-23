import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";

const examples = [
  "Unusual specifications or branding",
  "Large or wholesale quantities",
  "Items not currently listed",
  "Specialized or industrial equipment",
];

/**
 * Full-bleed contrasting editorial band (M14.3) — deep forest, not a
 * gold-gradient card floating on a light section. This is the homepage's
 * one deliberate deep-forest moment, distinct from the espresso hero.
 */
export function CustomSourcing() {
  return (
    <section id="custom-sourcing" className="bg-forest-950 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-16">
          <PackageSearch className="size-14 text-champagne-400" strokeWidth={1} />

          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-champagne-300 uppercase">
              Can&apos;t find what you need?
            </p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
              Tell us. We&apos;ll source it.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ivory-200/70">
              CrownSourceGlobal handles specialized, uncommon, and large-scale sourcing
              requirements. Submit what you&apos;re looking for and we manage the
              sourcing process — you&apos;ll receive a straightforward quotation you can
              accept and pay for like any other order.
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {examples.map((example) => (
                <li key={example} className="flex items-center gap-2 text-sm text-ivory-200/60">
                  <span className="size-1.5 rounded-full bg-champagne-400" aria-hidden />
                  {example}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link href="/sourcing">
                <Button size="lg" className="!bg-champagne-400 !text-espresso-950 hover:!bg-champagne-300">
                  Request custom sourcing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
