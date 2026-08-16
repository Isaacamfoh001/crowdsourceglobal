import { Layers, PackageSearch, ShoppingBag } from "lucide-react";
import { Section } from "../ui/Section";
import { SectionHeading } from "../ui/SectionHeading";

const paths = [
  {
    icon: ShoppingBag,
    title: "Shop normally",
    description:
      "Browse listings from approved vendors and buy the way you would on any modern marketplace. Add products from different vendors to the same cart and check out once.",
  },
  {
    icon: Layers,
    title: "Buy in bulk",
    description:
      "Select a larger quantity on eligible listings and get wholesale pricing instantly. Where pricing is already set, there's no back-and-forth before you can check out.",
  },
  {
    icon: PackageSearch,
    title: "Request custom sourcing",
    description:
      "Can't find it, need an unusual quantity, or have specific requirements? Tell us what you're looking for. We source it and send you a straightforward quotation.",
  },
];

export function PurchasingPaths() {
  return (
    <Section id="marketplace" tone="muted">
      <SectionHeading
        eyebrow="Three ways to buy"
        title="Whatever you're buying, there's a path for it."
        subtitle="Ordinary purchases stay simple. Bulk and custom needs are handled without extra complexity getting in your way."
      />

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {paths.map((path) => (
          <div
            key={path.title}
            className="flex flex-col rounded-2xl border border-stone-200 bg-stone-50 p-7 transition-shadow hover:shadow-lifted"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
              <path.icon className="size-5" strokeWidth={1.75} />
            </div>
            <h3 className="mt-5 font-display text-lg font-medium text-stone-900">
              {path.title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              {path.description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
