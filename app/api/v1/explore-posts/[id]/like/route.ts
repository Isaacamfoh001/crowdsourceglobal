import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { explorePostsService } from "../../../../../../modules/explore-posts/service";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../../../lib/rate-limit";

type Params = { id: string };

const ENGAGEMENT_RATE_LIMIT = { windowSeconds: 60, max: 60 };

/**
 * POST/DELETE /api/v1/explore-posts/[id]/like (M21 §9). Authenticated only
 * — an anonymous caller gets 401 so the mobile client can show its sign-in
 * prompt (never a silently-created anonymous like). Idempotent both ways:
 * liking an already-liked post, or unliking an already-unliked one, is a
 * safe no-op — see modules/explore-posts/repository.ts's unique-constraint
 * handling.
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to like posts.");

  const rateLimit = await checkActionRateLimit(`explore-post-like:${session.user.id}`, ENGAGEMENT_RATE_LIMIT);
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  const { id } = await params;
  const result = await explorePostsService.like(id, session.user.id);
  if (!result.ok) return apiError("NOT_FOUND", result.error);
  return apiSuccess({ liked: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to like posts.");

  const { id } = await params;
  await explorePostsService.unlike(id, session.user.id);
  return apiSuccess({ liked: false });
}
