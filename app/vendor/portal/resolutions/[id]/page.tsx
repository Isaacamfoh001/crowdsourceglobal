import Link from "next/link";
import { notFound } from "next/navigation";
import { requireVendorPortalContext } from "../../../../../modules/vendors/policy";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { CaseStatusBadge } from "../../../../../components/resolutions/CaseStatusBadge";
import { AskVendorResolutionButton } from "../../../../../components/resolutions/AskVendorResolutionButton";

type Params = { id: string };

export const metadata = { title: "Issue detail — Vendor Portal" };
export const dynamic = "force-dynamic";

/**
 * Deliberately restricted view (M9 §46): no customer identity, contact,
 * description, or conversation content — only the operational facts about
 * which of this vendor's items are affected. Everything else about the
 * case (customer details, decisions, refund amounts) is admin-only.
 */
export default async function VendorResolutionDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/resolutions");

  const detail = await resolutionsService.getForVendor(vendorId, id);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">{detail.caseNumber}</h1>
          <p className="mt-1 text-sm text-stone-500">Order {detail.orderNumber}</p>
        </div>
        <CaseStatusBadge status={detail.status} label={detail.statusLabel} />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-base font-medium text-stone-900">Affected item(s)</h2>
        <ul className="mt-3 divide-y divide-stone-100">
          {detail.items.map((item, index) => (
            <li key={index} className="py-2.5 text-sm text-stone-700">
              {item.description} × {item.quantityAffected}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-base font-medium text-stone-900">CrownSourceGlobal</h2>
        <p className="mt-1 text-sm text-stone-500">If CrownSourceGlobal needs information from you about this, it&apos;ll appear here.</p>
        <div className="mt-3">
          <AskVendorResolutionButton caseId={detail.id} label="Message CrownSourceGlobal about this" />
        </div>
      </div>

      <Link href="/vendor/portal/resolutions" className="text-sm font-medium text-brand-700 hover:underline">
        ← Back to issues
      </Link>
    </div>
  );
}
