import { StatusBadge } from "../ui/StatusBadge";
import type { BadgeTone } from "../ui/Badge";

function describe(listing: {
  approvalStatus: string;
  listingStatus: string;
  hasPendingChanges: boolean;
}): { label: string; tone: BadgeTone } {
  if (listing.approvalStatus === "PENDING") {
    return listing.hasPendingChanges
      ? { label: "Edit pending review", tone: "gold" }
      : { label: "Pending review", tone: "gold" };
  }
  if (listing.approvalStatus === "CHANGES_REQUESTED") {
    return { label: "Changes requested", tone: "warning" };
  }
  if (listing.approvalStatus === "REJECTED") {
    return { label: "Rejected", tone: "danger" };
  }
  if (listing.listingStatus === "ACTIVE") {
    return { label: "Active", tone: "success" };
  }
  if (listing.listingStatus === "INACTIVE") {
    return { label: "Hidden", tone: "neutral" };
  }
  return { label: "Draft", tone: "neutral" };
}

export function ListingStatusBadge({
  listing,
}: {
  listing: { approvalStatus: string; listingStatus: string; hasPendingChanges: boolean };
}) {
  const { label, tone } = describe(listing);
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
