import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { FulfilmentStatusBadge } from "../../../../components/fulfilment/FulfilmentStatusBadge";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { fulfilmentService } from "../../../../modules/fulfilment/service";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";

export const metadata = { title: "Operations — Admin" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "PENDING", label: "New" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready for collection" },
  { value: "DISPATCHED", label: "Dispatched" },
  { value: "EXCEPTION", label: "Issues" },
  { value: "DELIVERED", label: "Delivered" },
];

export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; origin?: string; page?: string }>;
}) {
  await requireAdminSession("/admin/operations", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const { status, origin, page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: fulfilments, total, pageSize } = await fulfilmentService.listForAdminPaginated({ status, origin }, currentPage);

  const qs = (nextStatus?: string) => {
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    if (origin) params.set("origin", origin);
    const s = params.toString();
    return s ? `/admin/operations?${s}` : "/admin/operations";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium text-espresso-950">Operations</h1>
        <Link href="/admin/operations/receiving-locations" className="text-sm font-medium text-espresso-800 hover:underline">
          Receiving locations
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={qs(filter.value)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                status === filter.value ? "border-espresso-800 bg-espresso-800 text-white" : "border-ivory-400 bg-ivory-50 text-espresso-800"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <Link
            href={origin === "INTERNATIONAL_INBOUND" ? qs(status) : `/admin/operations?${status ? `status=${status}&` : ""}origin=INTERNATIONAL_INBOUND`}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              origin === "INTERNATIONAL_INBOUND" ? "border-champagne-600 bg-champagne-200 text-espresso-900" : "border-ivory-400 bg-ivory-50 text-espresso-800"
            }`}
          >
            International only
          </Link>
        </div>
      </div>

      {fulfilments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ivory-400 bg-ivory-50 p-10 text-center">
          <p className="text-sm text-espresso-900/50">No fulfilments match this filter.</p>
        </div>
      ) : (
        <div className="divide-y divide-ivory-100 rounded-lg border border-ivory-300 bg-ivory-50">
          {fulfilments.map((f) => (
            <Link
              key={f.id}
              href={`/admin/operations/${f.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-espresso-950">{f.orderNumber}</p>
                  {f.hasOpenIssue ? <AlertTriangle className="size-4 text-danger-600" strokeWidth={1.75} /> : null}
                </div>
                <p className="text-xs text-espresso-900/50">
                  {f.vendorName} · {f.itemCount} item{f.itemCount === 1 ? "" : "s"}
                  {f.origin === "INTERNATIONAL_INBOUND" ? " · International" : " · Domestic"}
                </p>
              </div>
              <FulfilmentStatusBadge status={f.status} />
            </Link>
          ))}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        total={total}
        pageSize={pageSize}
        basePath="/admin/operations"
        extraParams={{ status, origin }}
      />
    </div>
  );
}
