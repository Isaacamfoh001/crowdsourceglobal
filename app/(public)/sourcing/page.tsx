import Link from "next/link";
import { PackageSearch, MessagesSquare, FileCheck, Truck } from "lucide-react";
import { Container } from "../../../components/ui/Container";
import { Button } from "../../../components/ui/Button";

export const metadata = {
  title: "Custom Sourcing",
  description: "Tell CrownSourceGlobal what you need and we'll source it for you.",
};

const STEPS = [
  { icon: MessagesSquare, title: "Tell us what you need", description: "A short description, quantity, and any specifications — no procurement expertise required." },
  { icon: PackageSearch, title: "We source it", description: "Our team reviews your request and works with marketplace vendors and other suppliers to find the right supply." },
  { icon: FileCheck, title: "You get a clear quotation", description: "One straightforward CrownSourceGlobal price — no supplier complexity to manage yourself." },
  { icon: Truck, title: "Accept, pay, and we deliver", description: "Same checkout and payment as any other order, with CrownSourceGlobal managing fulfilment." },
];

export default function SourcingLandingPage() {
  return (
    <div className="bg-ivory-50 py-14 sm:py-20">
      <Container className="max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-champagne-700">Can&apos;t find exactly what you need?</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-espresso-950 sm:text-5xl">
          Tell us. We&apos;ll source it.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-espresso-900/65">
          Custom sourcing is for requirements that don&apos;t exist in our marketplace yet — unusual
          specifications, custom branding, large quantities, or products we don&apos;t currently list.
          CrownSourceGlobal manages the sourcing process for you.
        </p>
        <div className="mt-8">
          <Link href="/sourcing/new">
            <Button size="lg">Start a sourcing request</Button>
          </Link>
        </div>
      </Container>

      <Container className="mt-16 max-w-4xl">
        <div className="grid gap-6 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-ivory-300 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-champagne-200 text-champagne-700">
                  <step.icon className="size-5" strokeWidth={1.75} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-espresso-900/35">Step {index + 1}</p>
              </div>
              <h2 className="mt-3 font-display text-base font-medium text-espresso-950">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-espresso-900/65">{step.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
