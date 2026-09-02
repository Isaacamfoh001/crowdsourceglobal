import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { vendorListingsService } from "../../../../../../modules/vendor-listings/service";
import type { BulkTierInput } from "../../../../../../modules/vendor-listings/types";
import { toVendorListingDetailDTO } from "../../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/** GET /api/v1/vendor/listings/:id (M27) — full detail incl. any staged pendingChanges (see M21.2 invariant). */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;
  const listing = await vendorListingsService.getDetail(context.vendorId, id);
  if (!listing) return apiError("NOT_FOUND", "Listing not found.");
  return apiSuccess(toVendorListingDetailDTO(listing));
}

/**
 * PATCH /api/v1/vendor/listings/:id (M27) — create/edit listing content.
 * `multipart/form-data`: title, description, categoryId, basePrice, moq,
 * maxOq?, leadTimeDays?, specs? (JSON object string), bulkTiers (JSON
 * array string, BulkTierInput[]), existingImages (repeated string field —
 * the kept image keys the vendor did not remove), images (0-5 new file
 * parts — PNG/JPEG/WEBP, <=5MB each, see
 * modules/vendor-listings/image-validation.ts). Real photo uploads only —
 * NEVER a pasted image URL (M27 CRITICAL IMAGE RULE). Whether this applies
 * directly, stages into `pendingChanges`, or is rejected as locked is
 * entirely `vendorListingsService.saveContent`'s decision (the M21.2
 * invariant) — this route never inspects listing status itself.
 */
export async function PATCH(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected multipart/form-data.");
  }

  const specsRaw = formData.get("specs");
  let specs: Record<string, string> | null | undefined;
  if (typeof specsRaw === "string" && specsRaw.length > 0) {
    try {
      specs = JSON.parse(specsRaw);
    } catch {
      return apiError("VALIDATION_ERROR", "Invalid specs payload.");
    }
  }

  const bulkTiersRaw = formData.get("bulkTiers");
  let bulkTiers: BulkTierInput[] = [];
  if (typeof bulkTiersRaw === "string" && bulkTiersRaw.length > 0) {
    try {
      bulkTiers = JSON.parse(bulkTiersRaw);
    } catch {
      return apiError("VALIDATION_ERROR", "Invalid pricing tiers payload.");
    }
  }

  const existingImages = formData.getAll("existingImages").map(String);
  const newImageFiles: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  for (const entry of formData.getAll("images")) {
    if (!(entry instanceof File)) continue;
    newImageFiles.push({ buffer: Buffer.from(await entry.arrayBuffer()), filename: entry.name, mimeType: entry.type });
  }

  const basePriceRaw = formData.get("basePrice");
  const moqRaw = formData.get("moq");
  const maxOqRaw = formData.get("maxOq");
  const leadTimeDaysRaw = formData.get("leadTimeDays");

  const result = await vendorListingsService.saveContent(
    context.vendorId,
    id,
    {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      basePrice: basePriceRaw ? Number(basePriceRaw) : 0,
      moq: moqRaw ? Number(moqRaw) : 1,
      maxOq: maxOqRaw ? Number(maxOqRaw) : null,
      leadTimeDays: leadTimeDaysRaw ? Number(leadTimeDaysRaw) : null,
      images: existingImages,
      specs,
    },
    bulkTiers,
    newImageFiles,
  );
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
