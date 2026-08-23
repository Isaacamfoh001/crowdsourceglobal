import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { vendorApplicationsService } from "../../../../modules/vendor-applications/service";
import { SELLER_TYPES } from "../../../../modules/vendor-applications/types";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Card } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";

export const metadata = { title: "Vendor applications — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminVendorApplicationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminSession("/admin/vendor-applications");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: applications, total, pageSize } = await vendorApplicationsService.listForAdminPaginated(undefined, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vendor applications" description={`${total} application${total === 1 ? "" : "s"}.`} />

      {applications.length === 0 ? (
        <EmptyState title="Nothing to review" description="No applications awaiting review." />
      ) : (
        <Card as="ul" padded={false} className="divide-y divide-ivory-100">
          {applications.map((application) => (
            <li key={application.id}>
              <Link
                href={`/admin/vendor-applications/${application.id}`}
                className="flex flex-col gap-1 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-espresso-950">{application.displayName ?? application.applicantName}</p>
                  <p className="text-xs text-espresso-900/50">
                    {application.applicantName} · {application.applicantEmail}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-espresso-900/50">
                  <span>{SELLER_TYPES.find((t) => t.value === application.sellerType)?.label ?? "—"}</span>
                  <Badge tone="gold">{application.status}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/vendor-applications" />
    </div>
  );
}
