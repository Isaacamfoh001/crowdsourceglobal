"use client";

import { useActionState, useState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { approveSettlementAction, cancelSettlementAction, recordSettlementPayoutAction, reverseSettlementAction } from "../../lib/actions/admin-finance";

const PAYOUT_METHODS = [
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "OTHER", label: "Other" },
];

function ApproveForm({ settlementId }: { settlementId: string }) {
  const [state, formAction, isPending] = useActionState(approveSettlementAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="settlementId" value={settlementId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Approving…" : "Approve settlement"}
      </Button>
    </form>
  );
}

function CancelForm({ settlementId }: { settlementId: string }) {
  const [state, formAction, isPending] = useActionState(cancelSettlementAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="settlementId" value={settlementId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Cancelling…" : "Cancel settlement"}
      </Button>
    </form>
  );
}

function RecordPayoutForm({ settlementId }: { settlementId: string }) {
  const [state, formAction, isPending] = useActionState(recordSettlementPayoutAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="settlementId" value={settlementId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <p className="text-sm text-stone-600">
        Only record a payout <strong>after</strong> you&apos;ve already sent the money externally (bank transfer or Mobile Money). This does not move any money itself.
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="method">
        Payout method used
        <select id="method" name="method" required disabled={isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
          {PAYOUT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="externalReference">
        External reference
        <input id="externalReference" name="externalReference" type="text" required placeholder="Bank/MoMo transaction reference" disabled={isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="paidAt">
        Date paid
        <input id="paidAt" name="paidAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} disabled={isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="note">
        Note (optional)
        <textarea id="note" name="note" rows={2} disabled={isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      </label>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Recording…" : "Record external payout"}
      </Button>
    </form>
  );
}

function ReverseForm({ settlementId }: { settlementId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, isPending] = useActionState(reverseSettlementAction, null);

  if (!expanded) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
        This payout was recorded incorrectly
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <input type="hidden" name="settlementId" value={settlementId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <p className="text-sm text-red-800">
        This does not un-record the original payout — it stays visible for history. It creates a correction that reduces this Vendor&apos;s future settlements.
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="reason">
        Reason
        <textarea id="reason" name="reason" required rows={2} disabled={isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      </label>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Reversing…" : "Confirm reversal"}
      </Button>
    </form>
  );
}

export function SettlementActions({ settlementId, status }: { settlementId: string; status: string }) {
  if (status === "DRAFT") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <ApproveForm settlementId={settlementId} />
        <CancelForm settlementId={settlementId} />
      </div>
    );
  }
  if (status === "APPROVED") {
    return (
      <div className="flex flex-col gap-4">
        <RecordPayoutForm settlementId={settlementId} />
        <CancelForm settlementId={settlementId} />
      </div>
    );
  }
  if (status === "PAID") {
    return <ReverseForm settlementId={settlementId} />;
  }
  return null;
}
