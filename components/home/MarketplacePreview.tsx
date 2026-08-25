import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "../ui/Container";
import type { PublicCategoryWithChildren } from "../../modules/catalogue/types";

/**
 * Editorial category index (M14.4) — replaces the icon-card grid rotating
 * through three tile tones. Categories are typeset as a large numbered
 * list instead: index number, oversized display name, hairline divider.
 * No icons, no fill-color rotation — scale and type do the work, the way a
 * magazine contents page reads rather than a SaaS feature grid.
 */
export function MarketplacePreview({ categories }: { categories: PublicCategoryWithChildren[] }) {
  return (
    <section className="bg-ivory-50 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">
            Everything beauty
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-espresso-950 sm:text-4xl">
            Hair, skin, and beauty — sold by the piece or by the case
          </h2>
        </div>

        <ul className="mt-12 border-t border-espresso-950/15">
          {categories.map((category, index) => (
            <li key={category.id} className="border-b border-espresso-950/15">
              <Link
                href={`/shop/${category.slug}`}
                className="group flex items-baseline gap-4 py-5 transition-colors sm:gap-8 sm:py-7"
              >
                <span className="w-6 shrink-0 font-display text-sm text-espresso-900/35 sm:w-10 sm:text-base">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-display text-2xl font-medium tracking-tight text-espresso-950 transition-colors group-hover:text-espresso-800 sm:text-4xl">
                  {category.name}
                </span>
                <ArrowUpRight
                  className="size-5 shrink-0 text-espresso-900/25 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-espresso-800 sm:size-6"
                  strokeWidth={1.5}
                />
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
