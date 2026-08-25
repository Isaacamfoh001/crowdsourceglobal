import Link from "next/link";
import { Container } from "../../../components/ui/Container";
import { Button } from "../../../components/ui/Button";

export const metadata = {
  title: "Source a Product",
  description:
    "Tell CrownSourceGlobal what you're looking for and we'll help coordinate sourcing it.",
};

const STEPS = [
  {
    number: "01",
    title: "Tell us what you need",
    description: "A short description, quantity, and any specifications — no procurement expertise required.",
  },
  {
    number: "02",
    title: "CrownSource coordinates sourcing",
    description: "Our team reviews your request and works with marketplace vendors and other suppliers to find the right supply.",
  },
  {
    number: "03",
    title: "Review your quotation",
    description: "One straightforward CrownSourceGlobal price — no supplier complexity to manage yourself.",
  },
  {
    number: "04",
    title: "Approve, pay, and we coordinate fulfilment",
    description: "Same checkout and payment as any other order, with CrownSourceGlobal managing fulfilment.",
  },
];

const EXAMPLES = [
  "Wholesale hair or human hair bundles",
  "A specific wig, lash, or cosmetics product",
  "Large quantities not currently listed",
  "A beauty supplier or manufacturer introduction",
];

export default function SourcingLandingPage() {
  return (
    <div className="bg-espresso-950">
      <Container className="max-w-2xl py-14 sm:py-20">
        <p className="text-xs font-semibold tracking-[0.2em] text-champagne-300 uppercase">
          Global beauty sourcing
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ivory-50 sm:text-5xl">
          Tell us what you need. We&apos;ll help find who makes it.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ivory-200/70">
          Source beauty products, wholesale quantities, or supplier and manufacturer
          opportunities beyond what&apos;s already listed. CrownSourceGlobal coordinates
          sourcing and sends you a straightforward quotation to approve and pay for like
          any other order.
        </p>
        <div className="mt-8">
          <Link href="/sourcing/new">
            <Button size="lg" className="!bg-champagne-400 !text-espresso-950 hover:!bg-champagne-300">
              Start a sourcing request
            </Button>
          </Link>
        </div>
      </Container>

      <div className="bg-ivory-100 py-14 sm:py-20">
        <Container className="max-w-4xl">
          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.number}>
                <span className="font-display text-3xl font-medium text-champagne-400/70">
                  {step.number}
                </span>
                <h2 className="mt-3 font-display text-base font-medium text-espresso-950">
                  {step.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-espresso-900/65">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-14 border-t border-ivory-300 pt-8">
            <p className="text-xs font-semibold tracking-[0.15em] text-champagne-700 uppercase">
              Examples of what people source
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {EXAMPLES.map((example) => (
                <li key={example} className="flex items-center gap-2 text-sm text-espresso-900/65">
                  <span className="size-1.5 rounded-full bg-champagne-500" aria-hidden />
                  {example}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </div>
    </div>
  );
}
