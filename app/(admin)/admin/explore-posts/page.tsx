import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { explorePostsService } from "../../../../modules/explore-posts/service";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Card } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";

export const metadata = { title: "Explore moderation — Admin" };
export const dynamic = "force-dynamic";

/** Mirrors app/(admin)/admin/listings/page.tsx exactly (M21) — same oldest-first paginated moderation queue shape. */
export default async function AdminExplorePostsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminSession("/admin/explore-posts");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: posts, total, pageSize } = await explorePostsService.listPendingForAdminPaginated(currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Explore posts awaiting review" description={`${total} post${total === 1 ? "" : "s"} pending moderation.`} />

      {posts.length === 0 ? (
        <EmptyState title="Nothing to review" description="No Explore posts awaiting review." />
      ) : (
        <Card as="ul" padded={false} className="divide-y divide-ivory-100">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/admin/explore-posts/${post.id}`}
                className="flex flex-col gap-1 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-espresso-950">{post.caption}</p>
                  <p className="text-xs text-espresso-900/50">{post.vendorName}</p>
                </div>
                <Badge tone={post.isEdit ? "gold" : "brand"} className="w-fit shrink-0">
                  {post.isEdit ? "Edit to live post" : "New post"}
                </Badge>
              </Link>
            </li>
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/explore-posts" />
    </div>
  );
}
