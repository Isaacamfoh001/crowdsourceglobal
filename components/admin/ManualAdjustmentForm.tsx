"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { createManualAdjustmentAction } from "../../lib/actions/admin-finance";

export function ManualAdjustmentForm({ vendorId, earnings }: { vendorId: string; earnings: { id: string; orderNumber: string }[] }) {
  const [state, formAction, isPending] = useActionState(createManualAdjustmentAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="vendorId" value={vendorId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state && state.ok ? <FormMessage tone="success">Correction recorded.</FormMessage> : null}

      <label className="flex flex-col gap-1.5 text-sm font-medium text-espresso-800" htmlFor="vendorEarningId">
        Earning
        <select id="vendorEarningId" name="vendorEarningId" required disabled={isPending} className="rounded-lg border border-ivory-400 px-3 py-2 text-sm">
          <option value="">Select an earning</option>
          {earnings.map((e) => (
            <option key={e.id} value={e.id}>
              Order {e.orderNumber}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-espresso-800" htmlFor="amount">
        Amount (negative to deduct, positive to credit)
        <input id="amount" name="amount" type="number" step="0.01" required disabled={isPending} className="rounded-lg border border-ivory-400 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-espresso-800" htmlFor="reason">
        Reason (internal)
        <textarea id="reason" name="reason" required rows={2} disabled={isPending} className="rounded-lg border border-ivory-400 px-3 py-2 text-sm" />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Recording…" : "Record correction"}
      </Button>
    </form>
  );
}
