import { Container } from "../ui/Container";

const steps = [
  {
    number: "01",
    title: "Tell us what you need",
    description:
      "Browse and add products to your cart, select a bulk quantity, or submit a custom sourcing request.",
  },
  {
    number: "02",
    title: "Get a clear price",
    description:
      "Standard and bulk pricing are shown upfront. Custom requests come back as a straightforward quotation.",
  },
  {
    number: "03",
    title: "Pay securely, track your order",
    description:
      "Pay through CrownSourceGlobal and follow progress from a single account, however many vendors are involved.",
  },
  {
    number: "04",
    title: "Receive it",
    description:
      "Vendors fulfil your order. If it spans multiple vendors, CrownSourceGlobal coordinates that for you.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-ivory-100 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-espresso-950 sm:text-4xl">
            From request to delivery, in four steps
          </h2>
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <span className="font-display text-4xl font-medium text-champagne-300">
                {step.number}
              </span>
              <h3 className="mt-3 font-display text-lg font-medium text-espresso-950">
                {step.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-espresso-900/70">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
