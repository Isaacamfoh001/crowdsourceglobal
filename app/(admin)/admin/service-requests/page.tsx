import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { serviceRequestsService } from "../../../../modules/service-requests/service";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Card } from "../../../../components/ui/Card";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import type { BadgeTone } from "../../../../components/ui/Badge";

export const metadata = { title: "Service requests — Admin" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = {
  SUBMITTED: "gold",
  PROVIDER_ACCEPTED: "success",
  PROVIDER_DECLINED: "danger",
  CANCELLED: "neutral",
};

/**
 * Admin operational visibility over every Beauty Services request (M22
 * §15). Read-only — CrownSourceGlobal remains between customer and
 * provider, but the accept/decline decision itself belongs to the
 * provider, not Admin. Newest-first, paginated, same convention as the
 * moderation queues.
 */
export default async function AdminServiceRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminSession("/admin/service-requests");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: requests, total, pageSize } = await serviceRequestsService.listForAdmin(currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Service requests" description={`${total} request${total === 1 ? "" : "s"} across all Beauty Professionals.`} />

      {requests.length === 0 ? (
        <EmptyState title="No requests yet" description="Customer service requests will appear here." />
      ) : (
        <Card as="ul" padded={false} className="divide-y divide-ivory-100">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/admin/service-requests/${request.id}`}
                className="flex flex-col gap-1 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-espresso-950">
                    {request.service.name} — {request.professional.name}
                  </p>
                  <p className="text-xs text-espresso-900/50">
                    {request.customer.name} · requested {new Date(request.preferredDate).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge tone={STATUS_TONE[request.status] ?? "neutral"} className="w-fit shrink-0">
                  {request.status.replaceAll("_", " ")}
                </StatusBadge>
              </Link>
            </li>
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/service-requests" />
    </div>
  );
}
