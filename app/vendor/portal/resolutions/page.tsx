import Link from "next/link";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { resolutionsService } from "../../../../modules/resolutions/service";
import { CaseStatusBadge } from "../../../../components/resolutions/CaseStatusBadge";
import { Pagination } from "../../../../components/shared/Pagination";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Issues — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorResolutionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/resolutions");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: cases, total, pageSize } = await resolutionsService.listForVendorPaginated(vendorId, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-espresso-950">Issues</h1>
        <p className="mt-1 text-[15px] text-espresso-900/50">Order issues CrownSourceGlobal is handling that involve your fulfilments.</p>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ivory-400 bg-white p-10 text-center">
          <p className="text-sm text-espresso-900/50">No issues right now.</p>
        </div>
      ) : (
        <div className="divide-y divide-ivory-100 rounded-2xl border border-ivory-300 bg-white">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/vendor/portal/resolutions/${c.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">{c.caseNumber}</p>
                <p className="text-xs text-espresso-900/50">Order {c.orderNumber}</p>
              </div>
              <CaseStatusBadge status={c.status} label={c.statusLabel} />
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/vendor/portal/resolutions" />
    </div>
  );
}
