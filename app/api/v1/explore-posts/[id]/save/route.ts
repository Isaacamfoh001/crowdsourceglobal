import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { explorePostsService } from "../../../../../../modules/explore-posts/service";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../../../lib/rate-limit";

type Params = { id: string };

const ENGAGEMENT_RATE_LIMIT = { windowSeconds: 60, max: 60 };

/** POST/DELETE /api/v1/explore-posts/[id]/save (M21 §10) — same authenticated-only, idempotent shape as the like route above. */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to save posts.");

  const rateLimit = await checkActionRateLimit(`explore-post-save:${session.user.id}`, ENGAGEMENT_RATE_LIMIT);
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  const { id } = await params;
  const result = await explorePostsService.save(id, session.user.id);
  if (!result.ok) return apiError("NOT_FOUND", result.error);
  return apiSuccess({ saved: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to save posts.");

  const { id } = await params;
  await explorePostsService.unsave(id, session.user.id);
  return apiSuccess({ saved: false });
}
