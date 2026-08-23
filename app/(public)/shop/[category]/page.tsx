import { notFound } from "next/navigation";
import { Container } from "../../../../components/ui/Container";
import { CategoryNav } from "../../../../components/catalogue/CategoryNav";
import { ListingCard } from "../../../../components/catalogue/ListingCard";
import { EmptyState } from "../../../../components/ui/EmptyState";
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
    <div className="bg-ivory-50">
      <div className="bg-espresso-950 py-7 sm:py-9">
        <Container>
          <Breadcrumbs
            items={[
              { label: "Shop", href: "/shop" },
              ...(parent ? [{ label: parent.name, href: `/shop/${parent.slug}` }] : []),
              { label: category.name },
            ]}
            dark
          />

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-display text-2xl font-medium text-white sm:text-3xl">{category.name}</h1>
            <div className="w-full sm:w-80">
              <SearchForm action={`/shop/${slug}`} defaultValue={q} />
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <CategoryNav categories={categories} activeSlug={slug} />

          <div className="min-w-0">
            <p className="mb-4 text-sm text-espresso-900/50">
              {total} listing{total === 1 ? "" : "s"}
              {q ? (
                <>
                  {" "}
                  for &ldquo;{q}&rdquo;
                </>
              ) : null}
            </p>

            {listings.length === 0 ? (
              <EmptyState
                title="No listings in this category yet"
                description="Check back soon, or browse another category."
              />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4">
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
