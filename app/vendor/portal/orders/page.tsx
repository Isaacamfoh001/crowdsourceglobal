import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { FulfilmentStatusBadge } from "../../../../components/fulfilment/FulfilmentStatusBadge";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { fulfilmentService } from "../../../../modules/fulfilment/service";

export const metadata = { title: "Orders — Vendor Portal" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { value: undefined, label: "All" },
  { value: "PENDING", label: "New" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready" },
  { value: "DISPATCHED", label: "Dispatched" },
  { value: "EXCEPTION", label: "Issues" },
  { value: "DELIVERED", label: "Delivered" },
];

export default async function VendorOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/orders");
  const { status } = await searchParams;
  const orders = await fulfilmentService.listForVendor(vendorId, status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">Orders</h1>
        <p className="mt-1 text-[15px] text-stone-500">Orders you need to prepare and hand over to CrownSourceGlobal.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/vendor/portal/orders?status=${filter.value}` : "/vendor/portal/orders"}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              status === filter.value
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No orders here yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/vendor/portal/orders/${order.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-stone-900">{order.orderNumber}</p>
                  {order.hasOpenIssue ? <AlertTriangle className="size-4 text-red-500" strokeWidth={1.75} /> : null}
                </div>
                <p className="text-xs text-stone-500">
                  {order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                  {order.itemCount} item{order.itemCount === 1 ? "" : "s"} · qty {order.totalQuantity}
                  {order.origin === "INTERNATIONAL_INBOUND" ? " · International" : ""}
                </p>
              </div>
              <FulfilmentStatusBadge status={order.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
