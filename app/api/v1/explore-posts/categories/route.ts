import { explorePostsService } from "../../../../../modules/explore-posts/service";
import { apiSuccess } from "../../../../../lib/api/response";

/**
 * GET /api/v1/explore-posts/categories — public, unauthenticated. Backs the
 * fixed beauty-work category allowlist (prisma/reference-data.ts's
 * EXPLORE_CATEGORY_SLUGS) used by Beauty Services/Beauty Professional
 * pickers (mobile's useExploreCategories, consumed by
 * app/beauty-services/index.tsx and features/vendor/beauty/BeautySections.tsx,
 * and the web equivalents under app/vendor/portal/beauty-professional/*).
 *
 * M32.10.2 — Explore post creation itself no longer uses this (photos +
 * caption only), but this route stays: it is NOT "category fetching
 * performed solely for Explore creation" — removing it breaks Beauty
 * Services/Beauty Professional category pickers, which the milestone
 * brief explicitly protects.
 */
export async function GET(_request: Request) {
  const categories = await explorePostsService.listCategories();
  return apiSuccess({ categories });
}
