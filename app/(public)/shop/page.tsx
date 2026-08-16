import { Container } from "../../../components/ui/Container";
import { CategoryNav } from "../../../components/catalogue/CategoryNav";
import { ListingCard } from "../../../components/catalogue/ListingCard";
import { EmptyState } from "../../../components/catalogue/EmptyState";
import { SearchForm } from "../../../components/catalogue/SearchForm";
import { catalogueService } from "../../../modules/catalogue/service";

export const metadata = {
  title: "Shop",
  description: "Browse listings from approved vendors on CrownSourceGlobal.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [categories, listings] = await Promise.all([
    catalogueService.listCategories(),
    catalogueService.listListings({ search: q }),
  ]);

  return (
    <div className="bg-stone-50 py-10 sm:py-14">
      <Container>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium text-stone-900">
              Shop the marketplace
            </h1>
            <p className="mt-1.5 text-[15px] text-stone-600">
              Browse listings from vendors CrownSourceGlobal has approved.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <SearchForm action="/shop" defaultValue={q} />
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
          <CategoryNav categories={categories} />

          <div className="min-w-0">
            {q ? (
              <p className="mb-4 text-sm text-stone-500">
                {listings.length} result{listings.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
              </p>
            ) : null}

            {listings.length === 0 ? (
              <EmptyState
                title="No listings match your search"
                description="Try a different keyword, or browse by category instead."
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
