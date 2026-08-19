import { notFound } from "next/navigation";
import { Container } from "../../../../components/ui/Container";
import { CategoryNav } from "../../../../components/catalogue/CategoryNav";
import { ListingCard } from "../../../../components/catalogue/ListingCard";
import { EmptyState } from "../../../../components/catalogue/EmptyState";
import { SearchForm } from "../../../../components/catalogue/SearchForm";
import { Breadcrumbs } from "../../../../components/catalogue/Breadcrumbs";
import { Pagination } from "../../../../components/shared/Pagination";
import { parsePage } from "../../../../lib/pagination";
import { catalogueService, CATALOGUE_PAGE_SIZE } from "../../../../modules/catalogue/service";

type Params = { category: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { category: slug } = await params;
  const category = await catalogueService.getCategoryBySlug(slug);
  return { title: category ? category.name : "Category" };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { category: slug } = await params;
  const { q, page: pageRaw } = await searchParams;
  const page = parsePage(pageRaw);

  const [categories, result] = await Promise.all([
    catalogueService.listCategories(),
    catalogueService.listListingsForCategorySlug(slug, { search: q, page, pageSize: CATALOGUE_PAGE_SIZE }),
  ]);

  if (!result.category) {
    notFound();
  }

  const { category, rows: listings, total } = result;
  const parent = categories.find((topLevel) =>
    topLevel.children.some((child) => child.slug === slug),
  );

  return (
    <div className="bg-stone-50 py-10 sm:py-14">
      <Container>
        <Breadcrumbs
          items={[
            { label: "Shop", href: "/shop" },
            ...(parent ? [{ label: parent.name, href: `/shop/${parent.slug}` }] : []),
            { label: category.name },
          ]}
        />

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="font-display text-3xl font-medium text-stone-900">{category.name}</h1>
          <div className="w-full sm:w-72">
            <SearchForm action={`/shop/${slug}`} defaultValue={q} />
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
          <CategoryNav categories={categories} activeSlug={slug} />

          <div className="min-w-0">
            {listings.length === 0 ? (
              <EmptyState
                title="No listings in this category yet"
                description="Check back soon, or browse another category."
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}

            <div className="mt-6">
              <Pagination
                currentPage={page}
                pageSize={CATALOGUE_PAGE_SIZE}
                total={total}
                basePath={`/shop/${slug}`}
                extraParams={{ q }}
              />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
