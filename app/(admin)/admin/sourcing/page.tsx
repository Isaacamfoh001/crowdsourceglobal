import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { sourcingService } from "../../../../modules/sourcing/service";
import { SourcingStatusBadge } from "../../../../components/sourcing/SourcingStatusBadge";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";

export const metadata = { title: "Sourcing — Admin" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "SUBMITTED" as const, label: "New" },
  { value: "UNDER_REVIEW" as const, label: "In Review" },
  { value: "SOURCING" as const, label: "Sourcing" },
  { value: "AWAITING_CUSTOMER" as const, label: "Awaiting Customer" },
  { value: "QUOTED" as const, label: "Quoted" },
  { value: "ACCEPTED" as const, label: "Accepted" },
  { value: "UNABLE_TO_SOURCE" as const, label: "Unable to Source" },
  { value: "CANCELLED" as const, label: "Cancelled" },
];

export default async function AdminSourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdminSession("/admin/sourcing");
  const { status, page } = await searchParams;
  const activeStatus = STATUS_FILTERS.find((f) => f.value === status)?.value;
  const currentPage = parsePage(page);

  const { rows: requests, total, pageSize } = await sourcingService.listForAdminPaginated({ status: activeStatus }, currentPage);
  const soonThreshold = new Date();
  soonThreshold.setDate(soonThreshold.getDate() + 3);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-stone-900">Sourcing requests</h1>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/sourcing?status=${filter.value}` : "/admin/sourcing"}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeStatus === filter.value
                ? "bg-brand-700 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No sourcing requests found.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/admin/sourcing/${request.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
                  {request.title}
                  {request.requiredByDate && request.requiredByDate < soonThreshold ? (
                    <TriangleAlert className="size-3.5 text-gold-600" strokeWidth={2} />
                  ) : null}
                </p>
                <p className="text-xs text-stone-500">
                  {request.requestNumber} · {request.customerName} · {request.quantity} {request.quantityUnit ?? ""} ·{" "}
                  {request.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {request.requiredByDate
                    ? ` · needed by ${request.requiredByDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                    : ""}
                  {request.assignedStaffName ? ` · assigned to ${request.assignedStaffName}` : " · unassigned"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {request.hasQuotation ? (
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">Quoted</span>
                ) : null}
                <SourcingStatusBadge status={request.status} label={request.statusLabel} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/sourcing" extraParams={{ status: activeStatus }} />
    </div>
  );
}
