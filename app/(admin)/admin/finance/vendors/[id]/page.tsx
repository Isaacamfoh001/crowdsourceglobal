import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminFinanceView } from "../../../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../../../lib/format";
import { CreateSettlementForm } from "../../../../../../components/admin/CreateSettlementForm";
import { ManualAdjustmentForm } from "../../../../../../components/admin/ManualAdjustmentForm";

export const metadata = { title: "Vendor Finance — Admin" };
export const dynamic = "force-dynamic";

const FINANCE_MUTATION_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN"];

export default async function AdminVendorFinanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdminFinanceView("/admin/finance");
  const { id } = await params;

  const detail = await vendorFinanceService.getVendorFinanceDetailForAdmin(id);
  if (!detail) notFound();

  const canMutate = FINANCE_MUTATION_ROLES.includes(admin.role);
  const eligibleEarnings = canMutate ? await vendorFinanceService.listEligibleEarningsForAdmin(id) : [];
  const { rows: recentEarnings } = await vendorFinanceService.listEarningsForVendor(id, undefined, 1);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/admin/finance" className="text-sm text-stone-500 hover:text-stone-700">
          ← Finance
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-stone-900">{detail.vendorName}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Eligible</p>
          <p className="mt-1.5 font-display text-lg font-medium text-emerald-700">{formatPrice(detail.eligible, detail.currency)}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Pending</p>
          <p className="mt-1.5 font-display text-lg font-medium text-stone-900">{formatPrice(detail.pending, detail.currency)}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Waiting period</p>
          <p className="mt-1.5 font-display text-lg font-medium text-amber-700">{formatPrice(detail.waitingPeriod, detail.currency)}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">On hold</p>
          <p className="mt-1.5 font-display text-lg font-medium text-red-700">{formatPrice(detail.onHold, detail.currency)}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Paid to date</p>
          <p className="mt-1.5 font-display text-lg font-medium text-stone-900">{formatPrice(detail.paidToDate, detail.currency)}</p>
        </div>
      </div>

      {detail.unappliedAdjustmentTotal !== 0 ? (
        <div className={`rounded-xl border p-4 text-sm ${detail.unappliedAdjustmentTotal < 0 ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          Outstanding adjustment balance: {formatPrice(detail.unappliedAdjustmentTotal, detail.currency)} — {detail.unappliedAdjustmentTotal < 0 ? "will offset future earnings before payout" : "will add to the next settlement"}.
        </div>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-display text-base font-medium text-stone-900">Payout destination</h2>
        {detail.destination ? (
          <p className="mt-2 text-sm text-stone-600">
            {detail.destination.type === "MOBILE_MONEY"
              ? `${detail.destination.momoNetwork ?? "Mobile Money"} — ${detail.destination.momoAccountName} — ${detail.destination.momoPhone}`
              : `${detail.destination.bankName} — ${detail.destination.bankAccountName} — ${detail.destination.bankAccountNumber}`}
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-500">Not set yet.</p>
        )}
      </div>

      {canMutate ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="font-display text-base font-medium text-stone-900">Create settlement</h2>
          <p className="mt-1 text-sm text-stone-500">Select the eligible earnings to include. Outstanding adjustments are applied automatically.</p>
          <div className="mt-4">
            <CreateSettlementForm vendorId={id} earnings={eligibleEarnings} />
          </div>
        </div>
      ) : null}

      {detail.recentSettlements.length > 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white">
          <h2 className="px-6 pt-6 font-display text-base font-medium text-stone-900">Recent settlements</h2>
          <div className="mt-3 divide-y divide-stone-100">
            {detail.recentSettlements.map((s) => (
              <Link key={s.id} href={`/admin/finance/settlements/${s.id}`} className="flex items-center justify-between gap-4 px-6 py-3 text-sm hover:bg-stone-50">
                <span className="text-stone-700">{s.settlementNumber}</span>
                <span className="font-medium text-stone-900">{formatPrice(s.netAmount, s.currency)}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {canMutate ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="font-display text-base font-medium text-stone-900">Manual correction</h2>
          <p className="mt-1 text-sm text-stone-500">For a wrongly-recorded payout or another one-off correction. Never edits an original earning — always an additive adjustment.</p>
          <div className="mt-4">
            <ManualAdjustmentForm vendorId={id} earnings={recentEarnings} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
