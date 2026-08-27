import { vendorsService } from "../../../../../modules/vendors/service";
import { CATALOGUE_PAGE_SIZE } from "../../../../../modules/catalogue/service";
import { parsePage } from "../../../../../lib/pagination";
import { apiError, apiPage, apiSuccess } from "../../../../../lib/api/response";
import { toListingSummaryDTO, toVendorStorefrontDTO } from "../../../../../lib/api/dto/catalogue";

type Params = { slug: string };

/**
 * GET /api/v1/vendors/[slug] — public, unauthenticated (M18.2). Reuses
 * vendorsService.getStorefront(slug, page, pageSize) verbatim — the exact
 * call the public storefront page makes. `findPublicVendorBySlug` only
 * ever matches `verificationStatus: "APPROVED"`, so an unapproved/
 * unpublished Vendor resolves to null here exactly as it does for the
 * web page's notFound() — never leaking existence via a different status
 * code. Its listings come from the same APPROVED+ACTIVE-scoped catalogue
 * query every other public listing endpoint uses.
 *
 * Deliberately excluded (never selected by the underlying repository
 * query at all, so there is nothing to accidentally leak): payout/
 * settlement/finance data, VendorMembership rows, VendorApplication
 * details, moderation notes, and private contact/pickup fields.
 */
export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  const storefront = await vendorsService.getStorefront(slug, page, CATALOGUE_PAGE_SIZE);
  if (!storefront) {
    return apiError("NOT_FOUND", "Vendor not found.");
  }

  return apiSuccess({
    vendor: toVendorStorefrontDTO(storefront.vendor),
    listings: apiPage({
      rows: storefront.listings.map(toListingSummaryDTO),
      total: storefront.total,
      page,
      pageSize: storefront.pageSize,
    }),
  });
}
