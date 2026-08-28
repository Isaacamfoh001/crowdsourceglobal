import { StatusBadge } from "../ui/StatusBadge";
import type { BadgeTone } from "../ui/Badge";

/** Mirrors ListingStatusBadge.tsx exactly — same approvalStatus/visibility describe() shape (M21). */
function describe(post: { approvalStatus: string; visibility: string; hasPendingChanges: boolean }): {
  label: string;
  tone: BadgeTone;
} {
  if (post.approvalStatus === "PENDING") {
    return post.hasPendingChanges ? { label: "Edit pending review", tone: "gold" } : { label: "Pending review", tone: "gold" };
  }
  if (post.approvalStatus === "CHANGES_REQUESTED") {
    return { label: "Changes requested", tone: "warning" };
  }
  if (post.approvalStatus === "REJECTED") {
    return { label: "Rejected", tone: "danger" };
  }
  if (post.visibility === "PUBLISHED") {
    return { label: "Live", tone: "success" };
  }
  if (post.visibility === "ARCHIVED") {
    return { label: "Archived", tone: "neutral" };
  }
  return { label: "Draft", tone: "neutral" };
}

export function ExplorePostStatusBadge({
  post,
}: {
  post: { approvalStatus: string; visibility: string; hasPendingChanges: boolean };
}) {
  const { label, tone } = describe(post);
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
