import { ClipboardCheck, ShieldCheck, Tags, Users } from "lucide-react";
import { Container } from "../ui/Container";

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
    <section className="bg-ivory-100 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">
            Why buyers choose us
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-espresso-950 sm:text-4xl">
            Sourcing without the coordination headache
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-espresso-900/70">
            CrownSourceGlobal manages the commercial relationship so you don&apos;t have to
            coordinate it yourself.
          </p>
        </div>

        <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {values.map((value) => (
            <div key={value.title} className="flex gap-4">
              <value.icon className="size-7 shrink-0 text-champagne-600" strokeWidth={1.25} />
              <div>
                <h3 className="font-display text-lg font-medium text-espresso-950">
                  {value.title}
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-espresso-900/70">
                  {value.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
