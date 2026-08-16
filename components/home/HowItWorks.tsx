import { Section } from "../ui/Section";
import { SectionHeading } from "../ui/SectionHeading";

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
    <Section id="how-it-works" tone="default">
      <SectionHeading
        eyebrow="How it works"
        title="From request to delivery, in four steps"
        align="center"
      />

      <div className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <div key={step.number} className="relative">
            <span className="font-display text-4xl font-medium text-brand-200">
              {step.number}
            </span>
            <h3 className="mt-3 font-display text-lg font-medium text-stone-900">
              {step.title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
