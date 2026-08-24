import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { resolutionsService } from "../../../../modules/resolutions/service";
import { CaseStatusBadge } from "../../../../components/resolutions/CaseStatusBadge";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Card } from "../../../../components/ui/Card";
import { EmptyState } from "../../../../components/ui/EmptyState";

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
      <PageHeader title="Resolutions" description={`${total} case${total === 1 ? "" : "s"}.`} />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/resolutions?status=${filter.value}` : "/admin/resolutions"}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeStatus === filter.value ? "bg-forest-800 text-white" : "bg-ivory-50 text-espresso-900/65 ring-1 ring-ivory-300 hover:bg-ivory-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {cases.length === 0 ? (
        <EmptyState title="No cases found" description="Try a different status filter." />
      ) : (
        <Card as="div" padded={false} className="divide-y divide-ivory-100">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/admin/resolutions/${c.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">{c.caseNumber}</p>
                <p className="text-xs text-espresso-900/50">
                  Order {c.orderNumber} · {c.customerName} · {c.issueType.replace(/_/g, " ").toLowerCase()}
                  {c.assignedStaffName ? ` · assigned to ${c.assignedStaffName}` : " · unassigned"}
                </p>
              </div>
              <CaseStatusBadge status={c.status} label={c.statusLabel} />
            </Link>
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/resolutions" extraParams={{ status: activeStatus }} />
    </div>
  );
}
