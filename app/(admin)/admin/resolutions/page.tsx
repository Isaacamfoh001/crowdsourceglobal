import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { resolutionsService } from "../../../../modules/resolutions/service";
import { CaseStatusBadge } from "../../../../components/resolutions/CaseStatusBadge";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";

export const metadata = { title: "Resolutions — Admin" };
export const dynamic = "force-dynamic";

const ADMIN_OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"] as const;

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "OPEN", label: "New" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "AWAITING_CUSTOMER", label: "Awaiting customer" },
  { value: "AWAITING_VENDOR", label: "Awaiting vendor" },
  { value: "RESOLUTION_APPROVED", label: "Approved" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CLOSED", label: "Closed" },
];

export default async function AdminResolutionsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const { status, page } = await searchParams;
  const activeStatus = STATUS_FILTERS.find((f) => f.value === status)?.value;
  const currentPage = parsePage(page);

  const { rows: cases, total, pageSize } = await resolutionsService.listForAdmin({ status: activeStatus }, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-stone-900">Resolutions</h1>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/resolutions?status=${filter.value}` : "/admin/resolutions"}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeStatus === filter.value ? "bg-brand-700 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No cases found.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/admin/resolutions/${c.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{c.caseNumber}</p>
                <p className="text-xs text-stone-500">
                  Order {c.orderNumber} · {c.customerName} · {c.issueType.replace(/_/g, " ").toLowerCase()}
                  {c.assignedStaffName ? ` · assigned to ${c.assignedStaffName}` : " · unassigned"}
                </p>
              </div>
              <CaseStatusBadge status={c.status} label={c.statusLabel} />
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/resolutions" extraParams={{ status: activeStatus }} />
    </div>
  );
}
