import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Section } from "../ui/Section";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const examples = [
  "Unusual specifications or branding",
  "Large or wholesale quantities",
  "Items not currently listed",
  "Specialized or industrial equipment",
];

export function CustomSourcing() {
  return (
    <Section id="custom-sourcing" tone="muted">
      <div className="overflow-hidden rounded-3xl border border-gold-200 bg-gradient-to-br from-gold-50 to-stone-50 p-10 sm:p-14">
        <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-16">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gold-400 text-white">
            <PackageSearch className="size-8" strokeWidth={1.5} />
          </div>

          <div>
            <Badge tone="gold">Can&apos;t find what you need?</Badge>
            <h2 className="mt-5 font-display text-3xl font-medium tracking-tight text-stone-900 sm:text-4xl">
              Tell us. We&apos;ll source it.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-stone-600">
              CrownSourceGlobal handles specialized, uncommon, and large-scale sourcing
              requirements. Submit what you&apos;re looking for and we manage the
              sourcing process — you&apos;ll receive a straightforward quotation you can
              accept and pay for like any other order.
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {examples.map((example) => (
                <li key={example} className="flex items-center gap-2 text-sm text-stone-600">
                  <span className="size-1.5 rounded-full bg-gold-500" aria-hidden />
                  {example}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Link href="/sourcing">
                <Button variant="primary" size="lg">
                  Request custom sourcing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
