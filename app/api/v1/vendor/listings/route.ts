import { z } from "zod";
import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../lib/api/vendor-context";
import { vendorListingsService } from "../../../../../modules/vendor-listings/service";
import { toVendorListingSummaryDTO } from "../../../../../lib/api/dto/vendor";
import { apiError, apiPage, apiSuccess } from "../../../../../lib/api/response";

/** GET /api/v1/vendor/listings (M27) — newest-first, paginated. `?page=`. */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const { rows, total, pageSize } = await vendorListingsService.listForVendorPaginated(context.vendorId, page);
  return apiSuccess(apiPage({ rows: rows.map(toVendorListingSummaryDTO), total, page, pageSize }));
}

const schema = z.object({ categoryId: z.string().trim().min(1, "Choose a category to start a listing.") });

/** POST /api/v1/vendor/listings (M27) — creates an empty DRAFT, same as web's "Create a new listing" entry point. JSON body: { categoryId }. */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Choose a category.");

  const result = await vendorListingsService.createDraft(context.vendorId, parsed.data.categoryId);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess({ id: result.value.listingId }, { status: 201 });
}
