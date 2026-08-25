import Link from "next/link";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";

const steps = [
  { number: "01", label: "Tell us what you need" },
  { number: "02", label: "CrownSource coordinates sourcing" },
  { number: "03", label: "Review your quotation" },
  { number: "04", label: "Approve, pay, and we coordinate fulfilment" },
];

const examples = [
  "Wholesale hair or beauty supplies",
  "Unusual specifications or branding",
  "Large quantities not currently listed",
  "Supplier or manufacturer introductions",
];

/**
 * Full-bleed contrasting editorial band (M14.3, recolored M17.1) — deep
 * espresso, not a gold-gradient card floating on a light section. The
 * strongest expression of CrownSource's global-sourcing differentiator
 * (positioned right after product discovery, not buried near the footer).
 */
export function CustomSourcing() {
  return (
    <section id="custom-sourcing" className="bg-espresso-950 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-champagne-300 uppercase">
            Can&apos;t find it?
          </p>
          <h2 className="mt-4 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Tell us what you need. We&apos;ll help find who makes it.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ivory-200/70">
            CrownSourceGlobal helps coordinate global sourcing for beauty products,
            suppliers, and manufacturers — beyond what&apos;s already listed. Submit a
            request and our sourcing team works it through to a straightforward
            quotation you can accept and pay for like any other order.
          </p>
        </div>

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.number}>
              <span className="font-display text-3xl font-medium text-champagne-400/70">
                {step.number}
              </span>
              <p className="mt-2 text-[15px] leading-snug font-medium text-ivory-50">{step.label}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-8 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {examples.map((example) => (
              <li key={example} className="flex items-center gap-2 text-sm text-ivory-200/60">
                <span className="size-1.5 rounded-full bg-champagne-400" aria-hidden />
                {example}
              </li>
            ))}
          </ul>

          <Link href="/sourcing" className="shrink-0">
            <Button size="lg" fullWidth className="!bg-champagne-400 !text-espresso-950 hover:!bg-champagne-300 sm:w-auto">
              Request sourcing
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
