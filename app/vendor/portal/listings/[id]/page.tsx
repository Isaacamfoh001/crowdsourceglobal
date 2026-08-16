import { notFound } from "next/navigation";
import { ListingEditorForm } from "../../../../../components/vendor-portal/ListingEditorForm";
import { InventoryForm } from "../../../../../components/vendor-portal/InventoryForm";
import { SubmitListingButton, ToggleActiveButton } from "../../../../../components/vendor-portal/SubmitListingButton";
import { ListingStatusBadge } from "../../../../../components/vendor-portal/ListingStatusBadge";
import { FormMessage } from "../../../../../components/ui/FormMessage";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">{listing.title || "Untitled listing"}</h1>
          <div className="mt-2 flex items-center gap-2">
            <ListingStatusBadge listing={{ ...listing, hasPendingChanges }} />
            {listing.approvalStatus === "APPROVED" ? (
              <ToggleActiveButton listingId={listing.id} active={listing.listingStatus === "ACTIVE"} />
            ) : null}
          </div>
        </div>
      </div>

      {listing.approvalStatus === "CHANGES_REQUESTED" && listing.changesRequestedReason ? (
        <FormMessage tone="error">
          <span className="font-medium">Admin requested changes:</span> {listing.changesRequestedReason}
        </FormMessage>
      ) : null}
      {listing.approvalStatus === "REJECTED" && listing.changesRequestedReason ? (
        <FormMessage tone="error">
          <span className="font-medium">This listing was rejected:</span> {listing.changesRequestedReason}
        </FormMessage>
      ) : null}
      {isLocked ? (
        <FormMessage tone="success">
          {hasPendingChanges
            ? "Your proposed changes are awaiting admin review. The current live version is still visible to customers."
            : "This listing is awaiting its first review."}
        </FormMessage>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-8">
        <ListingEditorForm listing={listing} categories={categories} disabled={isLocked} />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-8">
        <h2 className="font-display text-lg font-medium text-stone-900">Inventory</h2>
        <div className="mt-4">
          <InventoryForm
            listingId={listing.id}
            availableQuantity={listing.availableQuantity}
            availabilityStatus={listing.availabilityStatus}
          />
        </div>
      </div>

      {canSubmit && !isLocked ? (
        <SubmitListingButton
          listingId={listing.id}
          label={hasPendingChanges ? "Submit changes for review" : "Submit for review"}
        />
      ) : null}
    </div>
  );
}
