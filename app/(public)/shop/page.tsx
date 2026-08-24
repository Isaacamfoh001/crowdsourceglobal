import { Container } from "../../../components/ui/Container";
import { CategoryNav } from "../../../components/catalogue/CategoryNav";
import { ListingCard } from "../../../components/catalogue/ListingCard";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SearchForm } from "../../../components/catalogue/SearchForm";
import { Pagination } from "../../../components/shared/Pagination";
import { parsePage } from "../../../lib/pagination";
import { catalogueService, CATALOGUE_PAGE_SIZE } from "../../../modules/catalogue/service";

export const metadata = {
  title: "Shop",
  description: "Browse listings from approved vendors on CrownSourceGlobal.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageRaw } = await searchParams;
  const page = parsePage(pageRaw);

  const [categories, { rows: listings, total }] = await Promise.all([
    catalogueService.listCategories(),
    catalogueService.listListings({ search: q }, page, CATALOGUE_PAGE_SIZE),
  ]);

  return (
    <div className="bg-ivory-50">
      <div className="border-b border-ivory-300 py-8 sm:py-10">
        <Container>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">
                Everything beauty
              </p>
              <h1 className="mt-2 font-display text-3xl font-medium text-espresso-950 sm:text-4xl">
                Shop
              </h1>
            </div>
            <div className="w-full sm:w-96">
              <SearchForm action="/shop" defaultValue={q} />
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
          <CategoryNav categories={categories} />

          <div className="min-w-0">
            <p className="mb-5 text-sm text-espresso-900/60">
              {q ? (
                <>
                  {total} result{total === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
                </>
              ) : (
                <>
                  {total} listing{total === 1 ? "" : "s"} available
                </>
              )}
            </p>

            {listings.length === 0 ? (
              <EmptyState
                title="No listings match your search"
                description="Try a different keyword, browse by category, or let us source it for you."
                actionHref="/sourcing"
                actionLabel="Request custom sourcing"
              />
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 xl:grid-cols-4">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}

            <div className="mt-8">
              <Pagination
                currentPage={page}
                pageSize={CATALOGUE_PAGE_SIZE}
                total={total}
                basePath="/shop"
                extraParams={{ q }}
              />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
