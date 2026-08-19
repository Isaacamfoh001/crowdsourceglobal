"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { createSettlementAction } from "../../lib/actions/admin-finance";
import { formatPrice } from "../../lib/format";

type EligibleEarning = { id: string; currency: string; originalPayableAmount: number; orderNumber: string };

export function CreateSettlementForm({ vendorId, earnings }: { vendorId: string; earnings: EligibleEarning[] }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createSettlementAction, null);
  const [selected, setSelected] = useState<Set<string>>(new Set(earnings.map((e) => e.id)));

  if (state?.ok) {
    router.push(`/admin/finance/settlements/${state.value.settlementId}`);
  }

  const total = earnings.filter((e) => selected.has(e.id)).reduce((sum, e) => sum + e.originalPayableAmount, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (earnings.length === 0) {
    return <p className="text-sm text-stone-500">No eligible earnings to settle right now.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="vendorId" value={vendorId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
        {earnings.map((earning) => (
          <label key={earning.id} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-2.5">
              <input type="checkbox" name="earningId" value={earning.id} checked={selected.has(earning.id)} onChange={() => toggle(earning.id)} disabled={isPending} />
              Order {earning.orderNumber}
            </span>
            <span className="font-medium text-stone-900">{formatPrice(earning.originalPayableAmount, earning.currency)}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">Selected total</span>
        <span className="font-display text-lg font-medium text-stone-900">{formatPrice(total, earnings[0]?.currency ?? "GHS")}</span>
      </div>

      <Button type="submit" disabled={isPending || selected.size === 0}>
        {isPending ? "Creating…" : "Create settlement"}
      </Button>
    </form>
  );
}
