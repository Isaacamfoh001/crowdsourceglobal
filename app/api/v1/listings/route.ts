import { catalogueService, CATALOGUE_PAGE_SIZE } from "../../../../modules/catalogue/service";
import { parsePage } from "../../../../lib/pagination";
import { apiError, apiPage, apiSuccess } from "../../../../lib/api/response";
import { toListingSummaryDTO } from "../../../../lib/api/dto/catalogue";

/**
 * GET /api/v1/listings — public, unauthenticated (M18.2). One endpoint
 * covering what the web splits across /shop (?q=) and /shop/[category]
 * (a path segment) — a JSON API has no SEO reason to keep those as
 * separate paths, so `category` is just another query param here. Both
 * branches call the exact same catalogueService functions the web pages
 * already use; visibility (listingStatus ACTIVE only) is enforced entirely
 * by those functions' own repository query, never re-implemented here.
 * No `sort` param exists because none exists on the web today (newest-
 * first only) — not invented for this API.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? undefined;
  const categorySlug = url.searchParams.get("category") ?? undefined;
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  if (categorySlug) {
    const result = await catalogueService.listListingsForCategorySlug(categorySlug, {
      search,
      page,
      pageSize: CATALOGUE_PAGE_SIZE,
    });
    if (!result.category) {
      return apiError("NOT_FOUND", "Category not found.");
    }
    return apiSuccess(
      apiPage({ rows: result.rows.map(toListingSummaryDTO), total: result.total, page, pageSize: CATALOGUE_PAGE_SIZE }),
    );
  }

  const { rows, total } = await catalogueService.listListings({ search }, page, CATALOGUE_PAGE_SIZE);
  return apiSuccess(apiPage({ rows: rows.map(toListingSummaryDTO), total, page, pageSize: CATALOGUE_PAGE_SIZE }));
}
