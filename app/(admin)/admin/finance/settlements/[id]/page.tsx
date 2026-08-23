import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminFinanceView } from "../../../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../../../lib/format";
import { SettlementActions } from "../../../../../../components/admin/SettlementActions";
import { env } from "../../../../../../lib/env";

export const metadata = { title: "Settlement — Admin" };
export const dynamic = "force-dynamic";

const FINANCE_MUTATION_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN"];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-espresso-900/50">{label}</span>
      <span className="text-right font-medium text-espresso-950">{value}</span>
    </div>
  );
}

function destinationLabel(
  destination: { type: string; momoAccountName?: string | null; momoPhone?: string | null; momoNetwork?: string | null; bankAccountName?: string | null; bankName?: string | null; bankAccountNumber?: string | null } | null,
  isSnapshot: boolean,
): string {
  if (!destination) return "Not set — this vendor has no payout destination configured yet.";
  const label =
    destination.type === "MOBILE_MONEY"
      ? `${destination.momoNetwork ?? "Mobile Money"} — ${destination.momoAccountName} — ${destination.momoPhone}`
      : `${destination.bankName} — ${destination.bankAccountName} — ${destination.bankAccountNumber}`;
  // (M11.1) Not yet approved — this is the vendor's CURRENT destination,
  // shown as a preview, never the locked value actually paid out to.
  return isSnapshot ? label : `${label} (current — locked in when this settlement is approved)`;
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
        <Link href="/admin/finance/settlements" className="text-sm text-espresso-900/50 hover:text-espresso-800">
          ← Settlements
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-espresso-950">{settlement.settlementNumber}</h1>
        <Link href={`/admin/finance/vendors/${settlement.vendorId}`} className="text-sm text-forest-800 hover:underline">
          {settlement.vendorName}
        </Link>
      </div>

      {settlement.reversedAt ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800">
          <p className="font-medium">This payout was reversed</p>
          <p className="mt-1">{settlement.reversalReason}</p>
        </div>
      ) : null}

      {settlement.status === "PROCESSING" ? (
        <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
          <p className="font-medium">Payout processing</p>
          <p className="mt-1">CrownSourceGlobal sent this transfer to Paystack and is waiting for confirmation.</p>
        </div>
      ) : null}

      {settlement.status === "FAILED" ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800">
          <p className="font-medium">Payout failed</p>
          {settlement.payoutFailureReasonSafe ? <p className="mt-1">{settlement.payoutFailureReasonSafe}</p> : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-ivory-300 bg-white p-6">
        <Field label="Status" value={settlement.status} />
        <Field label="Gross" value={formatPrice(settlement.grossPayable, settlement.currency)} />
        {settlement.adjustmentTotal !== 0 ? <Field label="Adjustments" value={formatPrice(settlement.adjustmentTotal, settlement.currency)} /> : null}
        <Field label="Net amount" value={formatPrice(settlement.netAmount, settlement.currency)} />
        <Field label="Payout destination" value={destinationLabel(settlement.destination, settlement.destinationIsSnapshot)} />
        {settlement.payoutProvider ? <Field label="Payout method" value="Paystack (automated)" /> : settlement.payoutMethod ? <Field label="Payout method" value={settlement.payoutMethod} /> : null}
        {settlement.payoutProviderReference ? <Field label="Paystack reference" value={settlement.payoutProviderReference} /> : null}
        {settlement.payoutProviderTransferCode ? <Field label="Paystack transfer code" value={settlement.payoutProviderTransferCode} /> : null}
        {!settlement.payoutProvider && settlement.payoutExternalReference ? <Field label="External reference" value={settlement.payoutExternalReference} /> : null}
        {settlement.payoutPaidAt ? <Field label="Paid on" value={settlement.payoutPaidAt.toLocaleDateString()} /> : null}
        {settlement.payoutNote ? <Field label="Note" value={settlement.payoutNote} /> : null}
      </div>

      <div className="rounded-2xl border border-ivory-300 bg-white p-6">
        <h2 className="font-display text-base font-medium text-espresso-950">Included orders</h2>
        <div className="mt-3 divide-y divide-ivory-100">
          {settlement.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="text-espresso-900/65">Order {item.orderNumber}</span>
              <span className="font-medium text-espresso-950">{formatPrice(item.amount, settlement.currency)}</span>
            </div>
          ))}
        </div>
        {settlement.adjustments.length > 0 ? (
          <div className="mt-3 divide-y divide-ivory-100 border-t border-ivory-100 pt-3">
            {settlement.adjustments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-espresso-900/65">{a.reason}</span>
                <span className={`font-medium ${a.amount < 0 ? "text-danger-600" : "text-success-700"}`}>{formatPrice(a.amount, settlement.currency)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {canMutate ? (
        <div className="rounded-2xl border border-ivory-300 bg-white p-6">
          <SettlementActions settlementId={settlement.id} status={settlement.status} automatedPayoutsEnabled={env.PAYMENT_PROVIDER === "paystack"} />
        </div>
      ) : null}
    </div>
  );
}
