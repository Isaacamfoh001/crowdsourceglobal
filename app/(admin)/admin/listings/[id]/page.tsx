import { notFound } from "next/navigation";
import { ListingDecisionForms } from "../../../../../components/admin/ListingDecisionForms";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { vendorListingsService } from "../../../../../modules/vendor-listings/service";
import { formatPrice } from "../../../../../lib/format";

type Params = { id: string };

export const metadata = { title: "Listing review — Admin" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-900">{value || "—"}</dd>
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
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">{content.title}</h1>
        <p className="mt-1 text-sm text-stone-500">Sold by {listing.vendorName}</p>
      </div>

      {isEdit ? (
        <div className="rounded-xl border border-gold-200 bg-gold-50 p-4 text-sm text-gold-800">
          This is a proposed edit to a listing that&apos;s already live. The current public version is
          shown to customers until this edit is approved.
        </div>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <dl className="divide-y divide-stone-100">
          <Row label="Description" value={content.description} />
          <Row label="Price" value={formatPrice(content.basePrice, listing.currency)} />
          <Row label="MOQ" value={String(content.moq)} />
          <Row label="Max order qty" value={content.maxOq ? String(content.maxOq) : ""} />
          <Row label="Lead time (days)" value={content.leadTimeDays ? String(content.leadTimeDays) : ""} />
        </dl>
        {tiers.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-stone-900">Bulk pricing</p>
            <ul className="mt-2 flex flex-col gap-1">
              {tiers.map((tier, index) => (
                <li key={index} className="text-sm text-stone-600">
                  {tier.minQuantity}
                  {tier.maxQuantity ? `–${tier.maxQuantity}` : "+"}: {formatPrice(tier.unitPrice, listing.currency)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {reviewable ? (
        <ListingDecisionForms listingId={listing.id} isEdit={isEdit} />
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
          This listing is currently {listing.approvalStatus.toLowerCase().replace("_", " ")}.
        </div>
      )}
    </div>
  );
}
