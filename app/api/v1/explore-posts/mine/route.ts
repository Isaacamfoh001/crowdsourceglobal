import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveExplorePostPublisher } from "../../../../../modules/explore-posts/policy";
import { explorePostsService } from "../../../../../modules/explore-posts/service";
import { parsePage } from "../../../../../lib/pagination";
import { apiError, apiPage, apiSuccess } from "../../../../../lib/api/response";
import { absoluteExplorePostImageUrl } from "../../../../../lib/api/images";

/**
 * GET /api/v1/explore-posts/mine (M21) — the calling vendor's own posts at
 * every moderation status (PENDING/APPROVED/CHANGES_REQUESTED/REJECTED,
 * DRAFT/PUBLISHED/ARCHIVED), page-paginated (not the public feed's cursor
 * shape — this is a bounded "my content" list, same convention as the
 * Vendor Portal listings list). 403 for a signed-in caller with no
 * approved-Vendor membership, same as the create endpoint.
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const publisher = await resolveExplorePostPublisher(session.user.id);
  if (!publisher) return apiError("FORBIDDEN", "Only approved CrownSourceGlobal vendors can view Explore posts here.");

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  const { rows, total, pageSize } = await explorePostsService.listForVendor(publisher.vendorId, page);
  return apiSuccess(
    apiPage({
      rows: rows.map((post) => ({
        id: post.id,
        caption: post.caption,
        images: post.images.map(absoluteExplorePostImageUrl),
        approvalStatus: post.approvalStatus,
        visibility: post.visibility,
        hasPendingChanges: post.hasPendingChanges,
        changesRequestedReason: post.changesRequestedReason,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    }),
  );
}
