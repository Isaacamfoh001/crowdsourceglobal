import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { ListingDecisionForms } from "../../../../../components/admin/ListingDecisionForms";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { vendorListingsService } from "../../../../../modules/vendor-listings/service";
import { formatPrice } from "../../../../../lib/format";
import { listingImageUrl } from "../../../../../lib/listing-images";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { Alert } from "../../../../../components/ui/Alert";

type Params = { id: string };

export const metadata = { title: "Listing review — Admin" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-espresso-900/50">{label}</dt>
      <dd className="text-right font-medium text-espresso-950">{value || "—"}</dd>
    </div>
  );
}

export default async function AdminListingDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminSession("/admin/listings");
  const listing = await vendorListingsService.getForAdmin(id);

  if (!listing) {
    notFound();
  }

  const isEdit = listing.pendingChanges !== null;
  const content = listing.pendingChanges?.listing ?? listing;
  const tiers = listing.pendingChanges?.bulkPriceTiers ?? listing.bulkPriceTiers;
  const reviewable = listing.approvalStatus === "PENDING";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={content.title} description={`Sold by ${listing.vendorName}`} />

      {isEdit ? (
        <Alert tone="warning">
          This is a proposed edit to a listing that&apos;s already live. The current public version is
          shown to customers until this edit is approved.
        </Alert>
      ) : null}

      {content.images.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {content.images.map((image, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- storage-backed product photo, not Next's image optimizer
            <img
              key={index}
              src={listingImageUrl(image)}
              alt={`${content.title} photo ${index + 1}`}
              className="size-28 shrink-0 rounded-xl border border-ivory-300 object-cover sm:size-36"
            />
          ))}
        </div>
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-ivory-400 bg-ivory-50 text-ivory-400 sm:h-36 sm:w-36">
          <Package className="size-8" strokeWidth={1.5} />
        </div>
      )}

      <Card>
        <dl className="divide-y divide-ivory-100">
          <Row label="Description" value={content.description} />
          <Row label="Price" value={formatPrice(content.basePrice, listing.currency)} />
          <Row label="MOQ" value={String(content.moq)} />
          <Row label="Max order qty" value={content.maxOq ? String(content.maxOq) : ""} />
          <Row label="Lead time (days)" value={content.leadTimeDays ? String(content.leadTimeDays) : ""} />
        </dl>
        {tiers.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-espresso-950">Bulk pricing</p>
            <ul className="mt-2 flex flex-col gap-1">
              {tiers.map((tier, index) => (
                <li key={index} className="text-sm text-espresso-900/65">
                  {tier.minQuantity}
                  {tier.maxQuantity ? `–${tier.maxQuantity}` : "+"}: {formatPrice(tier.unitPrice, listing.currency)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {reviewable ? (
        <ListingDecisionForms listingId={listing.id} isEdit={isEdit} />
      ) : (
        <Card className="text-sm text-espresso-900/65">
          This listing is currently {listing.approvalStatus.toLowerCase().replace("_", " ")}.
        </Card>
      )}
    </div>
  );
}
