import { Compass } from "lucide-react";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Button } from "../../../../components/ui/Button";
import { ExplorePostStatusBadge } from "../../../../components/vendor-portal/ExplorePostStatusBadge";
import { Pagination } from "../../../../components/shared/Pagination";
import { explorePostImageUrl } from "../../../../lib/explore-post-images";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { explorePostsService } from "../../../../modules/explore-posts/service";
import { archiveExplorePostAction } from "../../../../lib/actions/explore-posts";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Explore — Vendor Portal" };
export const dynamic = "force-dynamic";

/**
 * Vendor Portal — Explore (M21 §18). Read-only-plus-archive: shows every
 * post the vendor has posted (any moderation/visibility status) and lets
 * them archive a live post. Post CREATION is deliberately mobile-only for
 * M21 V1 — camera roll/gallery access is already native there, and a
 * parallel multi-image web upload form would duplicate that exact flow for
 * marginal V1 benefit. See docs/mobile/MOBILE_V1_PLAN.md's M21 section.
 */
export default async function VendorExplorePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/explore");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: posts, total, pageSize } = await explorePostsService.listForVendor(vendorId, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Explore"
        description="Your beauty-work portfolio posts. Post new work from the CrownSourceGlobal mobile app — Select images → caption → category → submit."
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="You haven't posted to Explore yet"
          description="Open the CrownSourceGlobal mobile app to share a photo of your finished work — it'll appear here once submitted."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-ivory-200 border-t border-ivory-300">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center gap-4 py-3.5 sm:px-2">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ivory-100 sm:size-20">
                {post.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- storage-backed post photo, not Next's image optimizer
                  <img src={explorePostImageUrl(post.images[0])} alt="" className="size-full object-cover" />
                ) : (
                  <Compass className="size-6 text-ivory-400" strokeWidth={1.5} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-espresso-950">{post.caption}</p>
                {post.changesRequestedReason ? (
                  <p className="mt-1 truncate text-sm text-champagne-700">{post.changesRequestedReason}</p>
                ) : null}
                <div className="mt-2 sm:hidden">
                  <ExplorePostStatusBadge post={post} />
                </div>
              </div>

              <div className="hidden shrink-0 sm:block">
                <ExplorePostStatusBadge post={post} />
              </div>

              {post.visibility === "PUBLISHED" ? (
                <form action={archiveExplorePostAction} className="shrink-0">
                  <input type="hidden" name="postId" value={post.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Archive
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/vendor/portal/explore" />
    </div>
  );
}
