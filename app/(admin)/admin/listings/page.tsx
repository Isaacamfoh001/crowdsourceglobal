import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { vendorListingsService } from "../../../../modules/vendor-listings/service";
import { formatPrice } from "../../../../lib/format";

export const metadata = { title: "Listing moderation — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminListingsPage() {
  await requireAdminSession("/admin/listings");
  const listings = await vendorListingsService.listPendingForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-stone-900">Listings awaiting review</h1>

      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No listings awaiting review.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/admin/listings/${listing.id}`}
              className="flex flex-col gap-1 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{listing.title}</p>
                <p className="text-xs text-stone-500">
                  {listing.vendorName} · {formatPrice(listing.basePrice, listing.currency)}
                </p>
              </div>
              <span
                className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                  listing.isEdit ? "bg-gold-100 text-gold-800" : "bg-brand-100 text-brand-800"
                }`}
              >
                {listing.isEdit ? "Edit to live listing" : "New listing"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
