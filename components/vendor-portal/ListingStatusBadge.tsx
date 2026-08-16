function describe(listing: { approvalStatus: string; listingStatus: string; hasPendingChanges: boolean }) {
  if (listing.approvalStatus === "PENDING") {
    return listing.hasPendingChanges
      ? { label: "Edit pending review", tone: "bg-gold-100 text-gold-800" }
      : { label: "Pending review", tone: "bg-gold-100 text-gold-800" };
  }
  if (listing.approvalStatus === "CHANGES_REQUESTED") {
    return { label: "Changes requested", tone: "bg-red-100 text-red-700" };
  }
  if (listing.approvalStatus === "REJECTED") {
    return { label: "Rejected", tone: "bg-stone-200 text-stone-600" };
  }
  if (listing.listingStatus === "ACTIVE") {
    return { label: "Active", tone: "bg-brand-100 text-brand-800" };
  }
  if (listing.listingStatus === "INACTIVE") {
    return { label: "Hidden", tone: "bg-stone-200 text-stone-600" };
  }
  return { label: "Draft", tone: "bg-stone-100 text-stone-600" };
}

export function ListingStatusBadge({
  listing,
}: {
  listing: { approvalStatus: string; listingStatus: string; hasPendingChanges: boolean };
}) {
  const { label, tone } = describe(listing);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>
  );
}
