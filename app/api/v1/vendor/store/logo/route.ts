import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { vendorsService } from "../../../../../../modules/vendors/service";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

/**
 * POST /api/v1/vendor/store/logo (M29.1) — replace the store logo with a
 * real upload. `multipart/form-data`: one `logo` file part. Kept as its own
 * small endpoint (rather than folded into PATCH /api/v1/vendor/store's JSON
 * body) so the existing, well-tested text-field PATCH route stays untouched.
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected multipart/form-data.");
  }

  const logoEntry = formData.get("logo");
  if (!(logoEntry instanceof File) || logoEntry.size === 0) {
    return apiError("VALIDATION_ERROR", "Choose a logo image to upload.");
  }

  const result = await vendorsService.updateLogo(context.vendorId, {
    buffer: Buffer.from(await logoEntry.arrayBuffer()),
    mimeType: logoEntry.type,
  });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}

/** DELETE /api/v1/vendor/store/logo (M29.1) — remove the current logo, reverting to the initial-letter placeholder. */
export async function DELETE() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const result = await vendorsService.removeLogo(context.vendorId);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
