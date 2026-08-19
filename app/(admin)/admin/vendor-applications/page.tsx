import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { vendorApplicationsService } from "../../../../modules/vendor-applications/service";
import { SELLER_TYPES } from "../../../../modules/vendor-applications/types";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";

export const metadata = { title: "Vendor applications — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminVendorApplicationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminSession("/admin/vendor-applications");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: applications, total, pageSize } = await vendorApplicationsService.listForAdminPaginated(undefined, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-stone-900">Vendor applications</h1>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No applications awaiting review.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {applications.map((application) => (
            <Link
              key={application.id}
              href={`/admin/vendor-applications/${application.id}`}
              className="flex flex-col gap-1 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{application.displayName ?? application.applicantName}</p>
                <p className="text-xs text-stone-500">
                  {application.applicantName} · {application.applicantEmail}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500">
                <span>{SELLER_TYPES.find((t) => t.value === application.sellerType)?.label ?? "—"}</span>
                <span className="rounded-full bg-gold-100 px-2.5 py-1 font-semibold text-gold-800">
                  {application.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/vendor-applications" />
    </div>
  );
}
