import Link from "next/link";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { getCategoryIcon } from "../catalogue/categoryIcons";
import type { PublicCategoryWithChildren } from "../../modules/catalogue/types";

/**
 * Category tiles rotate through the new editorial palette — espresso (dark),
 * ivory-with-hairline-border (light), and a champagne-tinted tone — instead
 * of one flat white treatment repeated for every tile.
 */
const TILE_TONES = [
  "bg-espresso-950 text-ivory-50",
  "bg-ivory-50 text-espresso-950 border border-ivory-400",
  "bg-champagne-200/60 text-espresso-900",
];
const ICON_TONES = ["text-champagne-400", "text-forest-800", "text-champagne-700"];

/**
 * Real categories from the Catalogue domain — see app/(public)/page.tsx for
 * the fetch. Only the icon assignment and tone rotation are presentational;
 * everything else is live database content.
 */
export function MarketplacePreview({ categories }: { categories: PublicCategoryWithChildren[] }) {
  return (
    <section className="bg-ivory-100 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">
              Explore the marketplace
            </p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-espresso-950 sm:text-4xl">
              A catalogue built for everyday and bulk buying
            </h2>
          </div>
          <Link href="/shop" className="hidden sm:block">
            <Button
              variant="outline"
              className="!border-espresso-950/20 !text-espresso-950 hover:!border-espresso-950/40 hover:!bg-espresso-950/5"
            >
              Browse the marketplace
            </Button>
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {categories.map((category, index) => {
            const Icon = getCategoryIcon(category.slug);
            const tone = TILE_TONES[index % TILE_TONES.length]!;
            const iconTone = ICON_TONES[index % ICON_TONES.length]!;
            return (
              <Link
                key={category.id}
                href={`/shop/${category.slug}`}
                className={`group flex aspect-[4/5] flex-col justify-between p-5 transition-transform duration-200 hover:-translate-y-1 sm:p-6 ${tone}`}
              >
                <Icon className={`size-8 sm:size-9 ${iconTone}`} strokeWidth={1.1} />
                <div>
                  <span className="block h-px w-6 bg-current opacity-30" />
                  <p className="mt-3 font-display text-lg leading-snug font-medium sm:text-xl">
                    {category.name}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center sm:hidden">
          <Link href="/shop">
            <Button variant="outline">Browse the marketplace</Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
