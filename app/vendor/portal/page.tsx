import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileEdit,
  PackageX,
  Plus,
  ClipboardList,
  Wallet,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { formatPrice } from "../../../lib/format";
import { requireVendorPortalContext } from "../../../modules/vendors/policy";
import { vendorListingsService } from "../../../modules/vendor-listings/service";
import { fulfilmentService } from "../../../modules/fulfilment/service";
import { vendorFinanceService } from "../../../modules/vendor-finance/service";

export const metadata = { title: "Dashboard — Vendor Portal" };
export const dynamic = "force-dynamic";

/** Secondary at-a-glance figure — deliberately lower visual weight than the
 * "needs attention" section, which is where a vendor's eyes should land. */
function GlanceStat({
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
      className="flex min-w-[9.5rem] shrink-0 items-center gap-3 rounded-xl border border-ivory-300 bg-white px-4 py-3 transition-colors hover:border-ivory-400 hover:bg-ivory-50"
    >
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
          tone === "warning" ? "bg-champagne-200 text-champagne-700" : "bg-champagne-200 text-forest-900"
        }`}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold tabular-nums text-espresso-950">{value}</p>
        <p className="truncate text-xs text-espresso-900/50">{label}</p>
      </div>
    </Link>
  );
}

function timeAgo(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function VendorDashboardPage() {
  const { vendorId, vendor } = await requireVendorPortalContext("/vendor/portal");
  const [listings, orders, finance] = await Promise.all([
    vendorListingsService.listForVendor(vendorId),
    fulfilmentService.listForVendor(vendorId),
    vendorFinanceService.getOverviewForVendor(vendorId),
  ]);

  const active = listings.filter((l) => l.listingStatus === "ACTIVE").length;
  const pendingReview = listings.filter((l) => l.approvalStatus === "PENDING").length;
  const drafts = listings.filter((l) => l.listingStatus === "DRAFT" && l.approvalStatus !== "PENDING").length;
  const outOfStock = listings.filter((l) => l.availabilityStatus === "OUT_OF_STOCK").length;
  const lowStock = listings.filter((l) => l.availabilityStatus === "LOW_STOCK").length;
  const needsAttention = listings.filter((l) => l.approvalStatus === "CHANGES_REQUESTED");

  const newOrders = orders.filter((o) => o.status === "PENDING");
  const orderIssues = orders.filter((o) => o.hasOpenIssue);
  const hasAttentionItems = orderIssues.length > 0 || needsAttention.length > 0;
  const isLive = vendor.verificationStatus === "APPROVED";

  return (
    <div className="flex flex-col gap-8">
      {/* Warm welcome band — replaces a plain page title with the "this is my
          business" framing the client asked for, and surfaces the single most
          commercially urgent number (new orders) as the primary action. */}
      <div className="rounded-2xl border border-champagne-200 bg-champagne-200/20">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-forest-800 uppercase">
              {isLive ? "Store live" : "Store being set up"}
            </p>
            <h1 className="mt-1 font-display text-2xl font-medium text-espresso-950 sm:text-[28px]">
              Welcome back, {vendor.companyName}
            </h1>
            <p className="mt-1.5 text-sm text-espresso-900/65">
              {newOrders.length > 0
                ? `You have ${newOrders.length} new order${newOrders.length === 1 ? "" : "s"} waiting on you.`
                : "No new orders right now — good time to tidy up your listings."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link href="/vendor/portal/orders?status=PENDING">
              <Button variant={newOrders.length > 0 ? "primary" : "outline"} size="lg">
                <ClipboardList className="size-4.5" strokeWidth={1.75} />
                {newOrders.length > 0 ? `Review ${newOrders.length} new order${newOrders.length === 1 ? "" : "s"}` : "View orders"}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {hasAttentionItems ? (
        <div>
          <h2 className="font-display text-lg font-medium text-espresso-950">Needs your attention</h2>
          <div className="mt-3 flex flex-col gap-2">
            {orderIssues.map((order) => (
              <Link
                key={order.id}
                href={`/vendor/portal/orders/${order.id}`}
                className="flex items-center gap-3 rounded-xl border border-danger-200 bg-danger-50 p-4 transition-colors hover:border-danger-300"
              >
                <AlertTriangle className="size-5 shrink-0 text-danger-600" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-espresso-950">Order {order.orderNumber}</p>
                  <p className="mt-0.5 text-sm text-espresso-900/65">An issue was reported on this order.</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-espresso-900/35" strokeWidth={1.75} />
              </Link>
            ))}
            {needsAttention.map((listing) => (
              <Link
                key={listing.id}
                href={`/vendor/portal/listings/${listing.id}`}
                className="flex items-center gap-3 rounded-xl border border-champagne-300 bg-champagne-200/15 p-4 transition-colors hover:border-champagne-400"
              >
                <FileEdit className="size-5 shrink-0 text-champagne-700" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-espresso-950">{listing.title}</p>
                  <p className="mt-0.5 truncate text-sm text-espresso-900/65">{listing.changesRequestedReason}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-espresso-900/35" strokeWidth={1.75} />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {newOrders.length > 0 ? (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-espresso-950">New orders</h2>
            <Link href="/vendor/portal/orders?status=PENDING" className="text-sm font-medium text-forest-800 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-3 divide-y divide-ivory-100 overflow-hidden rounded-2xl border border-ivory-300 bg-white">
            {newOrders.slice(0, 4).map((order) => (
              <Link
                key={order.id}
                href={`/vendor/portal/orders/${order.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-ivory-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-espresso-950">{order.orderNumber}</p>
                  <p className="text-xs text-espresso-900/50">
                    {order.itemCount} item{order.itemCount === 1 ? "" : "s"} · qty {order.totalQuantity} ·{" "}
                    {timeAgo(order.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-forest-800">Prepare →</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="font-display text-lg font-medium text-espresso-950">Your listings at a glance</h2>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          <GlanceStat icon={CheckCircle2} label="Active listings" value={active} href="/vendor/portal/listings" />
          <GlanceStat icon={Clock} label="Pending review" value={pendingReview} href="/vendor/portal/listings" />
          <GlanceStat icon={FileEdit} label="Drafts" value={drafts} href="/vendor/portal/listings" />
          <GlanceStat icon={PackageX} label="Out of stock" value={outOfStock} href="/vendor/portal/listings" tone="warning" />
          <GlanceStat icon={AlertTriangle} label="Low stock" value={lowStock} href="/vendor/portal/listings" tone="warning" />
        </div>
      </div>

      <Link
        href="/vendor/portal/finance"
        className="flex items-center gap-4 rounded-2xl bg-forest-950 p-5 transition-colors hover:bg-forest-900 sm:p-6"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-champagne-200 text-forest-900">
          <Wallet className="size-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ivory-200/50">Available for payout</p>
          <p className="mt-0.5 font-display text-xl font-semibold text-ivory-50">
            {formatPrice(finance.availableForSettlement, finance.currency)}
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-champagne-300">View finance →</span>
      </Link>

      <Link
        href="/vendor/portal/listings/new"
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-ivory-400 bg-white p-6 text-sm font-medium text-forest-800 transition-colors hover:border-champagne-400/70 hover:bg-champagne-200/20"
      >
        <Plus className="size-4.5" strokeWidth={2} />
        Create a new listing
      </Link>
    </div>
  );
}
