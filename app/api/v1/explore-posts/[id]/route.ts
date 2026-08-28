import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveExplorePostPublisher } from "../../../../../modules/explore-posts/policy";
import { explorePostsService } from "../../../../../modules/explore-posts/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";

type Params = { id: string };

/**
 * PATCH /api/v1/explore-posts/[id] (M21 §23) — edit the caller's own post.
 * `multipart/form-data`: `caption`, `categoryId`, zero or more `keptImages`
 * (existing storage-key strings the vendor kept — an image is "removed"
 * simply by omitting its key, never deleted from storage, same convention
 * as vendor-listings), zero or more new `images` file parts.
 *
 * modules/explore-posts/service.ts's updateAndResubmit decides whether this
 * applies directly (CHANGES_REQUESTED/REJECTED — never public yet) or is
 * staged into `pendingChanges` (already PUBLISHED — the live post stays
 * visible/unchanged pending re-review). A post still awaiting its first
 * decision (PENDING, never yet PUBLISHED) can't be edited at all.
 */
export async function PATCH(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const publisher = await resolveExplorePostPublisher(session.user.id);
  if (!publisher) return apiError("FORBIDDEN", "Only approved CrownSourceGlobal vendors can manage Explore posts.");

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected multipart/form-data.");
  }

  const caption = String(formData.get("caption") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const keptImages = formData.getAll("keptImages").map(String);

  const newImageFiles: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  for (const entry of formData.getAll("images")) {
    if (!(entry instanceof File)) continue;
    newImageFiles.push({ buffer: Buffer.from(await entry.arrayBuffer()), filename: entry.name, mimeType: entry.type });
  }

  const { id } = await params;
  const result = await explorePostsService.updateAndResubmit(
    publisher.vendorId,
    id,
    { caption, categoryId },
    newImageFiles,
    keptImages,
  );
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess({ updated: true });
}
