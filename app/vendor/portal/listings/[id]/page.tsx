import { notFound } from "next/navigation";
import { BackLink } from "../../../../../components/ui/BackLink";
import { ListingEditorForm } from "../../../../../components/vendor-portal/ListingEditorForm";
import { InventoryForm } from "../../../../../components/vendor-portal/InventoryForm";
import { SubmitListingButton, ToggleActiveButton } from "../../../../../components/vendor-portal/SubmitListingButton";
import { ListingStatusBadge } from "../../../../../components/vendor-portal/ListingStatusBadge";
import { Alert } from "../../../../../components/ui/Alert";
import { Card } from "../../../../../components/ui/Card";
import { requireVendorPortalContext } from "../../../../../modules/vendors/policy";
import { vendorListingsService } from "../../../../../modules/vendor-listings/service";
import { catalogueService } from "../../../../../modules/catalogue/service";

type Params = { id: string };

export const metadata = { title: "Edit listing — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorListingEditorPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const { vendorId } = await requireVendorPortalContext(`/vendor/portal/listings/${id}`);

  const [listing, categories] = await Promise.all([
    vendorListingsService.getDetail(vendorId, id),
    catalogueService.listCategories(),
  ]);

  if (!listing) {
    notFound();
  }

  const hasPendingChanges = listing.pendingChanges !== null;
  // PENDING is also the schema default for a brand-new, never-submitted
  // draft — only treat it as "awaiting review" once the vendor has actually
  // submitted (submittedAt set). Without this check every new draft looked
  // locked from the moment it was created.
  const isLocked = listing.approvalStatus === "PENDING" && listing.submittedAt !== null;
  const canSubmit = listing.listingStatus === "DRAFT" || hasPendingChanges;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/vendor/portal/listings" label="All listings" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium break-words text-espresso-950 sm:text-[28px]">
            {listing.title || "Untitled listing"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ListingStatusBadge listing={{ ...listing, hasPendingChanges }} />
            {listing.approvalStatus === "APPROVED" ? (
              <ToggleActiveButton listingId={listing.id} active={listing.listingStatus === "ACTIVE"} />
            ) : null}
          </div>
        </div>
      </div>

      {listing.approvalStatus === "CHANGES_REQUESTED" && listing.changesRequestedReason ? (
        <Alert tone="warning" title="Admin requested changes">
          {listing.changesRequestedReason}
        </Alert>
      ) : null}
      {listing.approvalStatus === "REJECTED" && listing.changesRequestedReason ? (
        <Alert tone="danger" title="This listing was rejected">
          {listing.changesRequestedReason}
        </Alert>
      ) : null}
      {isLocked ? (
        <Alert tone="info">
          {hasPendingChanges
            ? "Your proposed changes are awaiting admin review. The current live version is still visible to customers."
            : "This listing is awaiting its first review."}
        </Alert>
      ) : null}

      <Card>
        <ListingEditorForm listing={listing} categories={categories} disabled={isLocked} />
      </Card>

      <Card>
        <h2 className="font-display text-lg font-medium text-espresso-950">Inventory</h2>
        <div className="mt-4">
          <InventoryForm
            listingId={listing.id}
            availableQuantity={listing.availableQuantity}
            availabilityStatus={listing.availabilityStatus}
          />
        </div>
      </Card>

      {canSubmit && !isLocked ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-champagne-300 bg-champagne-200/20 p-5">
          <p className="text-sm text-espresso-800">
            Save your title, description, price, and inventory above before submitting — a complete listing gets
            reviewed faster.
          </p>
          <SubmitListingButton
            listingId={listing.id}
            label={hasPendingChanges ? "Submit changes for review" : "Submit for review"}
          />
        </div>
      ) : null}
    </div>
  );
}
