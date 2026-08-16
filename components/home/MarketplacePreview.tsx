import Link from "next/link";
import {
  Armchair,
  Cpu,
  Factory,
  Package,
  Paintbrush,
  Shirt,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { Section } from "../ui/Section";
import { SectionHeading } from "../ui/SectionHeading";
import { Button } from "../ui/Button";

/**
 * Presentational category taxonomy for M0.5. Not backed by real listings —
 * M1 replaces this array with live category data from the Catalogue
 * domain without changing this component's layout.
 */
const categories = [
  { icon: Cpu, name: "Electronics & Devices" },
  { icon: Package, name: "Office & Supplies" },
  { icon: Shirt, name: "Textiles & Apparel" },
  { icon: Factory, name: "Industrial & Equipment" },
  { icon: Paintbrush, name: "Beauty & Personal Care" },
  { icon: Armchair, name: "Home & Living" },
  { icon: Wrench, name: "Tools & Hardware" },
  { icon: UtensilsCrossed, name: "Food & Beverage Supply" },
];

export function MarketplacePreview() {
  return (
    <Section tone="default">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Explore the marketplace"
          title="A catalogue built for everyday and bulk buying"
          subtitle="Categories are being onboarded as vendors join. Here's the range CrownSourceGlobal is organized to support."
        />
      </div>

      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <div
            key={category.name}
            className="flex flex-col items-start gap-3 rounded-2xl border border-stone-200 bg-white p-6 transition-colors hover:border-brand-300"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
              <category.icon className="size-5" strokeWidth={1.75} />
            </div>
            <p className="text-[15px] font-medium text-stone-900">{category.name}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link href="/sign-up">
          <Button variant="outline">Create an account to start browsing</Button>
        </Link>
      </div>
    </Section>
  );
}
