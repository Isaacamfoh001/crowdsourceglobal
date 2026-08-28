import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveExplorePostPublisher } from "../../../../../../modules/explore-posts/policy";
import { explorePostsService } from "../../../../../../modules/explore-posts/service";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

type Params = { id: string };

/**
 * POST /api/v1/explore-posts/[id]/archive (M21 §24) — unpublish, not
 * delete. Only the owning vendor may archive their own PUBLISHED post
 * (modules/explore-posts/repository.ts's archiveForVendor is ownership-
 * scoped in its WHERE clause). Images are never deleted from storage — see
 * modules/explore-posts/service.ts's image-cleanup doc comment.
 */
export async function POST(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const publisher = await resolveExplorePostPublisher(session.user.id);
  if (!publisher) return apiError("FORBIDDEN", "Only approved CrownSourceGlobal vendors can manage Explore posts.");

  const { id } = await params;
  const result = await explorePostsService.archive(publisher.vendorId, id);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess({ archived: true });
}
