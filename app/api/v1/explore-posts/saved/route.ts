import { getCurrentSession } from "../../../../../modules/identity/policy";
import { explorePostsService } from "../../../../../modules/explore-posts/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toExplorePostDTO } from "../../../../../lib/api/dto/explore-posts";

/**
 * GET /api/v1/explore-posts/saved (M21 §10) — the caller's own saved posts,
 * newest-saved-first, cursor-paginated. Authenticated only; there is no
 * anonymous saved list.
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to view your saved posts.");

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const page = await explorePostsService.getSaved(session.user.id, cursor);
  return apiSuccess({
    rows: page.rows.map((post) =>
      toExplorePostDTO(post, { likedByMe: page.likedIds.has(post.id), savedByMe: page.savedIds.has(post.id) }),
    ),
    nextCursor: page.nextCursor,
  });
}
