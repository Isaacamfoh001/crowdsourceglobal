import { catalogueService } from "../../../../modules/catalogue/service";
import { apiSuccess } from "../../../../lib/api/response";
import { toCategoryWithChildrenDTO } from "../../../../lib/api/dto/catalogue";

/**
 * GET /api/v1/categories — public, unauthenticated (M18.2). Reuses
 * catalogueService.listCategories() verbatim — the same canonical
 * top-level-with-children taxonomy the web homepage/Shop category nav
 * already render. No mobile-specific category model.
 */
export async function GET(_request: Request) {
  const categories = await catalogueService.listCategories();
  return apiSuccess({ categories: categories.map(toCategoryWithChildrenDTO) });
}
