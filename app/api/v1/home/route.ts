import { catalogueService } from "../../../../modules/catalogue/service";
import { apiSuccess } from "../../../../lib/api/response";
import { toCategoryWithChildrenDTO, toListingSummaryDTO } from "../../../../lib/api/dto/catalogue";

/**
 * GET /api/v1/home — public, unauthenticated (M18.2). A single aggregate
 * call so a native Home screen isn't forced into several sequential
 * round trips on a slow connection before it can render anything.
 *
 * Deliberately mirrors ONLY what app/(public)/page.tsx (the real web
 * homepage) actually fetches today — categories and
 * catalogueService.listFeaturedListings(6) — nothing more. There is no
 * "featured Vendors" section here because no such query exists anywhere
 * in the codebase (no vendor-listing/browse query, no "featured" flag on
 * Vendor); inventing one would be exactly the fabricated-data Phase 7
 * warns against. "Featured" itself is really "most recently
 * approved/active", same as the web — not a curation flag.
 */
export async function GET(_request: Request) {
  const [categories, featuredListings] = await Promise.all([
    catalogueService.listCategories(),
    catalogueService.listFeaturedListings(6),
  ]);

  return apiSuccess({
    categories: categories.map(toCategoryWithChildrenDTO),
    featuredListings: featuredListings.map(toListingSummaryDTO),
  });
}
