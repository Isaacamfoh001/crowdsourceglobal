import { catalogueService } from "../../../../modules/catalogue/service";
import { apiSuccess } from "../../../../lib/api/response";
import { toCategoryDTO, toListingSummaryDTO } from "../../../../lib/api/dto/catalogue";

/**
 * GET /api/v1/explore — public, unauthenticated (M18.2).
 *
 * Distinct from /home and /listings on purpose, not merely for symmetry
 * with MOBILE_V1_PLAN.md's navigation: /home returns one flat "6 most
 * recent overall" list, which can end up dominated by whichever category
 * happened to get listed most recently; /listings is a single paginated
 * grid a shopper pages through deliberately. /explore instead groups a
 * small, recent slice PER top-level category (catalogueService.
 * listExploreSections) — this is the "category diversity" MOBILE_V1_PLAN.md
 * describes for Explore V1's "simple deterministic ranking", using only
 * existing catalogue queries (no new repository query, no ranking model).
 * A category with no live listings is omitted, never shown empty.
 *
 * No personalization, no behavioral tracking, no algorithmic feed — see
 * catalogueService.listExploreSections's own doc comment.
 */
export async function GET(_request: Request) {
  const sections = await catalogueService.listExploreSections();

  return apiSuccess({
    sections: sections.map((section) => ({
      category: toCategoryDTO(section.category),
      listings: section.listings.map(toListingSummaryDTO),
    })),
  });
}
