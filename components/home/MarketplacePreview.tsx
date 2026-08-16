import Link from "next/link";
import { Section } from "../ui/Section";
import { SectionHeading } from "../ui/SectionHeading";
import { Button } from "../ui/Button";
import { getCategoryIcon } from "../catalogue/categoryIcons";
import type { PublicCategoryWithChildren } from "../../modules/catalogue/types";

/**
 * Real categories from the Catalogue domain — see app/(public)/page.tsx for
 * the fetch. Only the icon assignment is presentational (categoryIcons.ts);
 * everything else is live database content.
 */
export function MarketplacePreview({ categories }: { categories: PublicCategoryWithChildren[] }) {
  return (
    <Section tone="default">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Explore the marketplace"
          title="A catalogue built for everyday and bulk buying"
          subtitle="Browse listings from vendors CrownSourceGlobal has approved, organized by category."
        />
      </div>

      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.slug);
          return (
            <Link
              key={category.id}
              href={`/shop/${category.slug}`}
              className="flex flex-col items-start gap-3 rounded-2xl border border-stone-200 bg-white p-6 transition-colors hover:border-brand-300"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
                <Icon className="size-5" strokeWidth={1.75} />
              </div>
              <p className="text-[15px] font-medium text-stone-900">{category.name}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 flex justify-center">
        <Link href="/shop">
          <Button variant="outline">Browse the marketplace</Button>
        </Link>
      </div>
    </Section>
  );
}
