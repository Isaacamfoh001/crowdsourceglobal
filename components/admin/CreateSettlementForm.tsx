"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { createSettlementAction } from "../../lib/actions/admin-finance";
import { formatPrice } from "../../lib/format";

type EligibleEarning = { id: string; currency: string; originalPayableAmount: number; orderNumber: string };

export function CreateSettlementForm({
  vendorId,
  earnings,
  unappliedAdjustmentTotal,
}: {
  vendorId: string;
  earnings: EligibleEarning[];
  /** (M11.1) Vendor-wide, swept in full into any new settlement regardless of which earnings are selected — see createSettlementTransactional. */
  unappliedAdjustmentTotal: number;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createSettlementAction, null);
  const [selected, setSelected] = useState<Set<string>>(new Set(earnings.map((e) => e.id)));

  // (M11.1) Navigation must never happen directly in the render body — that
  // triggers "Cannot update a component (Router) while rendering a
  // different component." Only fire once, when the action actually
  // succeeds, and only for that specific result (not on every re-render).
  useEffect(() => {
    if (state?.ok) {
      router.push(`/admin/finance/settlements/${state.value.settlementId}`);
    }
  }, [state, router]);

  const grossSelected = earnings.filter((e) => selected.has(e.id)).reduce((sum, e) => sum + e.originalPayableAmount, 0);
  // (M11.1) Preview only — the server independently recomputes and enforces
  // this exact formula in createSettlementTransactional; the client total
  // is never trusted for the actual settlement amount.
  const netTotal = grossSelected + unappliedAdjustmentTotal;
  const currency = earnings[0]?.currency ?? "GHS";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (earnings.length === 0) {
    return <p className="text-sm text-espresso-900/50">No eligible earnings to settle right now.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="vendorId" value={vendorId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="divide-y divide-ivory-100 rounded-xl border border-ivory-300">
        {earnings.map((earning) => (
          <label key={earning.id} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-2.5">
              <input type="checkbox" name="earningId" value={earning.id} checked={selected.has(earning.id)} onChange={() => toggle(earning.id)} disabled={isPending} />
              Order {earning.orderNumber}
            </span>
            <span className="font-medium text-espresso-950">{formatPrice(earning.originalPayableAmount, earning.currency)}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-ivory-300 bg-ivory-50 p-3">
        <div className="flex items-center justify-between text-sm text-espresso-900/50">
          <span>Selected earnings</span>
          <span>{formatPrice(grossSelected, currency)}</span>
        </div>
        {unappliedAdjustmentTotal !== 0 ? (
          <div className="flex items-center justify-between text-sm text-espresso-900/50">
            <span>Outstanding adjustments</span>
            <span className={unappliedAdjustmentTotal < 0 ? "text-danger-700" : "text-success-700"}>{formatPrice(unappliedAdjustmentTotal, currency)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex items-center justify-between border-t border-ivory-300 pt-1.5">
          <span className="text-sm font-medium text-espresso-800">Net payable</span>
          <span className={`font-display text-lg font-medium ${netTotal <= 0 ? "text-danger-700" : "text-espresso-950"}`}>{formatPrice(netTotal, currency)}</span>
        </div>
      </div>
      {netTotal <= 0 ? (
        <p className="text-xs text-danger-600">Outstanding adjustments exceed the selected earnings — select more earnings, or wait for future earnings to offset the balance.</p>
      ) : null}

      <Button type="submit" disabled={isPending || selected.size === 0 || netTotal <= 0}>
        {isPending ? "Creating…" : "Create settlement"}
      </Button>
    </form>
  );
}
