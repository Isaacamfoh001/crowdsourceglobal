import { getCurrentSession } from "../../../../modules/identity/policy";
import { resolveExplorePostPublisher } from "../../../../modules/explore-posts/policy";
import { explorePostsService } from "../../../../modules/explore-posts/service";
import { catalogueRepository } from "../../../../modules/catalogue/repository";
import { apiError, apiSuccess } from "../../../../lib/api/response";
import { toExplorePostDTO } from "../../../../lib/api/dto/explore-posts";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../lib/rate-limit";

/**
 * GET /api/v1/explore-posts — public, unauthenticated (M21). PUBLISHED +
 * APPROVED posts only, newest-first, cursor-paginated (see
 * modules/explore-posts/repository.ts's encodeExploreFeedCursor). A signed-
 * in caller additionally gets real `likedByMe`/`savedByMe`; an anonymous
 * caller always gets `false` for both — never an anonymous like/save
 * record (CLAUDE.md M21 §9/§10).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const categorySlug = url.searchParams.get("category") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;

  let categoryId: string | undefined;
  if (categorySlug) {
    const category = await catalogueRepository.findCategoryBySlug(categorySlug);
    if (!category) return apiError("NOT_FOUND", "Category not found.");
    categoryId = category.id;
  }

  const session = await getCurrentSession();
  const feed = await explorePostsService.getFeed({ categoryId, cursor, viewerUserId: session?.user.id });

  return apiSuccess({
    rows: feed.rows.map((post) =>
      toExplorePostDTO(post, { likedByMe: feed.likedIds.has(post.id), savedByMe: feed.savedIds.has(post.id) }),
    ),
    nextCursor: feed.nextCursor,
  });
}

const CREATE_RATE_LIMIT = { windowSeconds: 60 * 60, max: 10 };

/**
 * POST /api/v1/explore-posts — create AND submit a post in one shot (M21
 * §17: mobile's create flow has no persisted "save as draft" step). Only an
 * approved-Vendor-membership caller may post — see
 * modules/explore-posts/policy.ts. `multipart/form-data`: `caption`
 * (string), `categoryId` (string), one or more `images` file parts (1-6,
 * PNG/JPEG/WEBP, <=5MB each — modules/explore-posts/image-validation.ts).
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const publisher = await resolveExplorePostPublisher(session.user.id);
  if (!publisher) return apiError("FORBIDDEN", "Only approved CrownSourceGlobal vendors can post to Explore.");

  const rateLimit = await checkActionRateLimit(`explore-post-create:${publisher.vendorId}`, CREATE_RATE_LIMIT);
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected multipart/form-data.");
  }

  const caption = String(formData.get("caption") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");

  const imageFiles: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  for (const entry of formData.getAll("images")) {
    if (!(entry instanceof File)) continue;
    imageFiles.push({ buffer: Buffer.from(await entry.arrayBuffer()), filename: entry.name, mimeType: entry.type });
  }

  const result = await explorePostsService.createAndSubmit(publisher.vendorId, { caption, categoryId }, imageFiles);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess({ id: result.value.postId }, { status: 201 });
}
