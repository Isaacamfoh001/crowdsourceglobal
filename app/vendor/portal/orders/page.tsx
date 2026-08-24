import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Card } from "../../../../components/ui/Card";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { FulfilmentStatusBadge } from "../../../../components/fulfilment/FulfilmentStatusBadge";
import { Pagination } from "../../../../components/shared/Pagination";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { fulfilmentService } from "../../../../modules/fulfilment/service";
import { parsePage } from "../../../../lib/pagination";

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
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/orders");
  const { status, page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: orders, total, pageSize } = await fulfilmentService.listForVendorPaginated(vendorId, status, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Orders" description="Orders you need to prepare and hand over to CrownSourceGlobal." />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/vendor/portal/orders?status=${filter.value}` : "/vendor/portal/orders"}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              status === filter.value
                ? "border-forest-800 bg-forest-800 text-white"
                : "border-ivory-400 bg-ivory-50 text-espresso-800"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No orders here yet" description="Orders matching this filter will show up here." />
      ) : (
        <Card as="div" padded={false} className="divide-y divide-ivory-100">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/vendor/portal/orders/${order.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-espresso-950">{order.orderNumber}</p>
                  {order.hasOpenIssue ? <AlertTriangle className="size-4 text-danger-600" strokeWidth={1.75} /> : null}
                </div>
                <p className="text-xs text-espresso-900/50">
                  {order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                  {order.itemCount} item{order.itemCount === 1 ? "" : "s"} · qty {order.totalQuantity}
                  {order.origin === "INTERNATIONAL_INBOUND" ? " · International" : ""}
                </p>
              </div>
              <FulfilmentStatusBadge status={order.status} />
            </Link>
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/vendor/portal/orders" extraParams={{ status }} />
    </div>
  );
}
