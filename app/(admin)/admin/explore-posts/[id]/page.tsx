import { notFound } from "next/navigation";
import { ExplorePostDecisionForms } from "../../../../../components/admin/ExplorePostDecisionForms";
import { ListingImageReview } from "../../../../../components/admin/ListingImageReview";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { explorePostsService } from "../../../../../modules/explore-posts/service";
import { catalogueRepository } from "../../../../../modules/catalogue/repository";
import { explorePostImageUrl } from "../../../../../lib/explore-post-images";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { Alert } from "../../../../../components/ui/Alert";
import { BackLink } from "../../../../../components/ui/BackLink";

type Params = { id: string };

export const metadata = { title: "Explore post review — Admin" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-espresso-900/50">{label}</dt>
      <dd className="text-right font-medium text-espresso-950">{value || "—"}</dd>
    </div>
  );
}

/** Mirrors app/(admin)/admin/listings/[id]/page.tsx exactly (M21) — same staged-edit-vs-direct-review layout, reusing ListingImageReview's lightbox. */
export default async function AdminExplorePostDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminSession("/admin/explore-posts");
  const post = await explorePostsService.getForAdmin(id);

  if (!post) {
    notFound();
  }

  const isEdit = post.pendingChanges !== null;
  const content = post.pendingChanges
    ? { caption: post.pendingChanges.caption, categoryId: post.pendingChanges.categoryId, images: post.pendingChanges.images }
    : post;
  const reviewable = post.approvalStatus === "PENDING";
  // The pending edit may have changed the category — always resolve the
  // name from `content.categoryId`, never assume it still matches
  // post.category (the live category), which would be wrong for an edit.
  const category = isEdit ? await catalogueRepository.findCategoryById(content.categoryId) : post.category;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/explore-posts" label="Back to Explore moderation" />

      <PageHeader title="Explore post" description={`Posted by ${post.vendorName}`} />

      {isEdit ? (
        <Alert tone="warning">
          This is a proposed edit to a post that&apos;s already live. The current public version is shown to
          customers until this edit is approved.
        </Alert>
      ) : null}

      <ListingImageReview images={content.images} title={post.caption} resolveUrl={explorePostImageUrl} label="Post photos" />

      <Card>
        <dl className="divide-y divide-ivory-100">
          <Row label="Caption" value={content.caption} />
          <Row label="Category" value={category?.name ?? ""} />
        </dl>
      </Card>

      {reviewable ? (
        <ExplorePostDecisionForms postId={post.id} isEdit={isEdit} />
      ) : (
        <Card className="text-sm text-espresso-900/65">
          This post is currently {post.approvalStatus.toLowerCase().replace("_", " ")}.
        </Card>
      )}
    </div>
  );
}
