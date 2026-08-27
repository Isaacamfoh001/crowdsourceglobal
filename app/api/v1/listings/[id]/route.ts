import { catalogueService } from "../../../../../modules/catalogue/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toListingDetailDTO } from "../../../../../lib/api/dto/catalogue";

type Params = { id: string };

/**
 * GET /api/v1/listings/[id] — public, unauthenticated (M18.2). Reuses
 * catalogueService.getListingDetail(id) verbatim — the same call the
 * public listing-detail page makes. That function's repository query is
 * scoped to APPROVED + ACTIVE (modules/catalogue/repository.ts's
 * PUBLIC_LISTING_WHERE), so a draft/pending/rejected/inactive listing —
 * or a listing with only pendingChanges awaiting moderation — resolves to
 * null here exactly as it does for the web page's own notFound(), never
 * a 403 that would confirm the id exists.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const listing = await catalogueService.getListingDetail(id);
  if (!listing) {
    return apiError("NOT_FOUND", "Listing not found.");
  }
  return apiSuccess(toListingDetailDTO(listing));
}
