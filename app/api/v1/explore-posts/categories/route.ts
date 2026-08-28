import { explorePostsService } from "../../../../../modules/explore-posts/service";
import { apiSuccess } from "../../../../../lib/api/response";

/**
 * GET /api/v1/explore-posts/categories — public, unauthenticated (M21).
 * Backs the mobile create-post category picker (and any future category
 * filter chip row on the feed) with exactly the fixed Explore allowlist
 * (prisma/reference-data.ts's EXPLORE_CATEGORY_SLUGS) — never the full
 * commerce taxonomy /api/v1/categories returns.
 */
export async function GET(_request: Request) {
  const categories = await explorePostsService.listCategories();
  return apiSuccess({ categories });
}
