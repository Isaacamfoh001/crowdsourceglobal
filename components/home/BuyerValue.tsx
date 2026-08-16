import { ClipboardCheck, ShieldCheck, Tags, Users } from "lucide-react";
import { Section } from "../ui/Section";
import { SectionHeading } from "../ui/SectionHeading";

const values = [
  {
    icon: Users,
    title: "One place, many vendors",
    description:
      "Stop juggling supplier calls and separate checkouts. Buy from multiple approved vendors in a single order.",
  },
  {
    icon: ShieldCheck,
    title: "Approved vendors only",
    description:
      "Every vendor is reviewed before their listings go live on the marketplace.",
  },
  {
    icon: ClipboardCheck,
    title: "Clear order visibility",
    description:
      "Track your order, quotation, or custom request from one account — no chasing separate email threads.",
  },
  {
    icon: Tags,
    title: "Straightforward pricing",
    description:
      "Bulk pricing is shown upfront on eligible listings. No negotiating for standard quantity breaks.",
  },
];

export function BuyerValue() {
  return (
    <Section tone="muted">
      <SectionHeading
        eyebrow="Why buyers choose us"
        title="Sourcing without the coordination headache"
        subtitle="CrownSourceGlobal manages the commercial relationship so you don't have to coordinate it yourself."
      />

      <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2">
        {values.map((value) => (
          <div key={value.title} className="flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
              <value.icon className="size-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-display text-lg font-medium text-stone-900">
                {value.title}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">
                {value.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
