import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminFinanceView } from "../../../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../../../lib/format";
import { SettlementActions } from "../../../../../../components/admin/SettlementActions";

export const metadata = { title: "Settlement — Admin" };
export const dynamic = "force-dynamic";

const FINANCE_MUTATION_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN"];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="text-right font-medium text-stone-900">{value}</span>
    </div>
  );
}

function destinationLabel(destination: { type: string; momoAccountName?: string | null; momoPhone?: string | null; momoNetwork?: string | null; bankAccountName?: string | null; bankName?: string | null; bankAccountNumber?: string | null } | null): string {
  if (!destination) return "Not set";
  if (destination.type === "MOBILE_MONEY") return `${destination.momoNetwork ?? "Mobile Money"} — ${destination.momoAccountName} — ${destination.momoPhone}`;
  return `${destination.bankName} — ${destination.bankAccountName} — ${destination.bankAccountNumber}`;
}

export default async function AdminSettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdminFinanceView("/admin/finance");
  const { id } = await params;

  const result = await vendorFinanceService.getSettlementDetailForAdmin(id);
  if (!result.ok) notFound();
  const settlement = result.value;
  const canMutate = FINANCE_MUTATION_ROLES.includes(admin.role);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/admin/finance/settlements" className="text-sm text-stone-500 hover:text-stone-700">
          ← Settlements
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-stone-900">{settlement.settlementNumber}</h1>
        <Link href={`/admin/finance/vendors/${settlement.vendorId}`} className="text-sm text-brand-700 hover:underline">
          {settlement.vendorName}
        </Link>
      </div>

      {settlement.reversedAt ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">This payout was reversed</p>
          <p className="mt-1">{settlement.reversalReason}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <Field label="Status" value={settlement.status} />
        <Field label="Gross" value={formatPrice(settlement.grossPayable, settlement.currency)} />
        {settlement.adjustmentTotal !== 0 ? <Field label="Adjustments" value={formatPrice(settlement.adjustmentTotal, settlement.currency)} /> : null}
        <Field label="Net amount" value={formatPrice(settlement.netAmount, settlement.currency)} />
        <Field label="Payout destination" value={destinationLabel(settlement.destination)} />
        {settlement.payoutMethod ? <Field label="Payout method" value={settlement.payoutMethod} /> : null}
        {settlement.payoutExternalReference ? <Field label="External reference" value={settlement.payoutExternalReference} /> : null}
        {settlement.payoutPaidAt ? <Field label="Paid on" value={settlement.payoutPaidAt.toLocaleDateString()} /> : null}
        {settlement.payoutNote ? <Field label="Note" value={settlement.payoutNote} /> : null}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-display text-base font-medium text-stone-900">Included orders</h2>
        <div className="mt-3 divide-y divide-stone-100">
          {settlement.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="text-stone-600">Order {item.orderNumber}</span>
              <span className="font-medium text-stone-900">{formatPrice(item.amount, settlement.currency)}</span>
            </div>
          ))}
        </div>
        {settlement.adjustments.length > 0 ? (
          <div className="mt-3 divide-y divide-stone-100 border-t border-stone-100 pt-3">
            {settlement.adjustments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-stone-600">{a.reason}</span>
                <span className={`font-medium ${a.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatPrice(a.amount, settlement.currency)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {canMutate ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <SettlementActions settlementId={settlement.id} status={settlement.status} />
        </div>
      ) : null}
    </div>
  );
}
