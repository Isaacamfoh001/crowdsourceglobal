import Link from "next/link";
import { getCategoryIcon } from "./categoryIcons";
import type { PublicCategoryWithChildren } from "../../modules/catalogue/types";

export function CategoryNav({
  categories,
  activeSlug,
}: {
  categories: PublicCategoryWithChildren[];
  activeSlug?: string;
}) {
  return (
    <nav aria-label="Categories" className="min-w-0">
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-2 lg:hidden">
        <Link
          href="/shop"
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
            !activeSlug
              ? "border-brand-700 bg-brand-700 text-white"
              : "border-stone-300 bg-white text-stone-700"
          }`}
        >
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/shop/${category.slug}`}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
              activeSlug === category.slug
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="hidden flex-col gap-1 lg:flex">
        <Link
          href="/shop"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            !activeSlug ? "bg-brand-100 text-brand-800" : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          All categories
        </Link>
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.slug);
          const isActiveParent = activeSlug === category.slug;
          const hasActiveChild = category.children.some((child) => child.slug === activeSlug);

          return (
            <div key={category.id}>
              <Link
                href={`/shop/${category.slug}`}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActiveParent
                    ? "bg-brand-100 text-brand-800"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {category.name}
              </Link>
              {category.children.length > 0 && (isActiveParent || hasActiveChild) ? (
                <div className="ml-6 mt-1 flex flex-col gap-1 border-l border-stone-200 pl-3">
                  {category.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/shop/${child.slug}`}
                      className={`rounded-lg px-2.5 py-1.5 text-sm ${
                        activeSlug === child.slug
                          ? "font-medium text-brand-800"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
