import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileEdit, PackageX } from "lucide-react";
import { requireVendorPortalContext } from "../../../modules/vendors/policy";
import { vendorListingsService } from "../../../modules/vendor-listings/service";

export const metadata = { title: "Dashboard — Vendor Portal" };
export const dynamic = "force-dynamic";

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  tone = "neutral",
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  href: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-5 transition-shadow hover:shadow-lifted"
    >
      <div>
        <p className="text-2xl font-semibold text-stone-900">{value}</p>
        <p className="mt-0.5 text-sm text-stone-500">{label}</p>
      </div>
      <div
        className={`flex size-10 items-center justify-center rounded-lg ${
          tone === "warning" ? "bg-gold-100 text-gold-700" : "bg-brand-100 text-brand-800"
        }`}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
    </Link>
  );
}

export default async function VendorDashboardPage() {
  const { vendorId, vendor } = await requireVendorPortalContext("/vendor/portal");
  const listings = await vendorListingsService.listForVendor(vendorId);

  const active = listings.filter((l) => l.listingStatus === "ACTIVE").length;
  const pendingReview = listings.filter((l) => l.approvalStatus === "PENDING").length;
  const drafts = listings.filter((l) => l.listingStatus === "DRAFT" && l.approvalStatus !== "PENDING").length;
  const outOfStock = listings.filter((l) => l.availabilityStatus === "OUT_OF_STOCK").length;
  const lowStock = listings.filter((l) => l.availabilityStatus === "LOW_STOCK").length;
  const needsAttention = listings.filter((l) => l.approvalStatus === "CHANGES_REQUESTED");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">Dashboard</h1>
        <p className="mt-1 text-[15px] text-stone-500">
          {vendor.verificationStatus === "APPROVED" ? "Your store is live." : "Your store is being set up."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={CheckCircle2} label="Active listings" value={active} href="/vendor/portal/listings" />
        <StatCard icon={Clock} label="Pending review" value={pendingReview} href="/vendor/portal/listings" />
        <StatCard icon={FileEdit} label="Drafts" value={drafts} href="/vendor/portal/listings" />
        <StatCard icon={PackageX} label="Out of stock" value={outOfStock} href="/vendor/portal/listings" tone="warning" />
        <StatCard icon={AlertTriangle} label="Low stock" value={lowStock} href="/vendor/portal/listings" tone="warning" />
      </div>

      {needsAttention.length > 0 ? (
        <div>
          <h2 className="font-display text-lg font-medium text-stone-900">Needs your attention</h2>
          <div className="mt-3 flex flex-col gap-2">
            {needsAttention.map((listing) => (
              <Link
                key={listing.id}
                href={`/vendor/portal/listings/${listing.id}`}
                className="rounded-xl border border-gold-200 bg-gold-50 p-4 hover:border-gold-300"
              >
                <p className="text-sm font-medium text-stone-900">{listing.title}</p>
                <p className="mt-1 text-sm text-stone-600">{listing.changesRequestedReason}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <Link
        href="/vendor/portal/listings/new"
        className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm font-medium text-brand-700 hover:border-brand-300"
      >
        + Create a new listing
      </Link>
    </div>
  );
}
