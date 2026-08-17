import Link from "next/link";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { resolutionsService } from "../../../../modules/resolutions/service";
import { CaseStatusBadge } from "../../../../components/resolutions/CaseStatusBadge";

export const metadata = { title: "Issues — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorResolutionsPage() {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/resolutions");
  const cases = await resolutionsService.listForVendor(vendorId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">Issues</h1>
        <p className="mt-1 text-[15px] text-stone-500">Order issues CrownSourceGlobal is handling that involve your fulfilments.</p>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No issues right now.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/vendor/portal/resolutions/${c.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{c.caseNumber}</p>
                <p className="text-xs text-stone-500">Order {c.orderNumber}</p>
              </div>
              <CaseStatusBadge status={c.status} label={c.statusLabel} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
