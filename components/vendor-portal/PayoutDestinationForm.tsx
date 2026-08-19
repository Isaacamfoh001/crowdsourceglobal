"use client";

import { useActionState, useState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { upsertPayoutDestinationAction } from "../../lib/actions/vendor-finance";

const NETWORKS = [
  { value: "MTN", label: "MTN Mobile Money" },
  { value: "TELECEL", label: "Telecel Cash" },
  { value: "AT", label: "AirtelTigo Money" },
];

type Existing = {
  type: "MOBILE_MONEY" | "BANK_TRANSFER";
  momoAccountName: string | null;
  momoNetwork: string | null;
  bankAccountName: string | null;
  bankName: string | null;
} | null;

export function PayoutDestinationForm({ existing }: { existing: Existing }) {
  const [state, formAction, isPending] = useActionState(upsertPayoutDestinationAction, null);
  const [type, setType] = useState<"MOBILE_MONEY" | "BANK_TRANSFER">(existing?.type ?? "MOBILE_MONEY");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state && state.ok ? <FormMessage tone="success">Payout details updated.</FormMessage> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-stone-700">Payout method</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium ${type === "MOBILE_MONEY" ? "border-stone-800 bg-stone-900 text-white" : "border-stone-300 text-stone-700"}`}>
            <input type="radio" name="type" value="MOBILE_MONEY" checked={type === "MOBILE_MONEY"} onChange={() => setType("MOBILE_MONEY")} className="sr-only" />
            Mobile Money
          </label>
          <label className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium ${type === "BANK_TRANSFER" ? "border-stone-800 bg-stone-900 text-white" : "border-stone-300 text-stone-700"}`}>
            <input type="radio" name="type" value="BANK_TRANSFER" checked={type === "BANK_TRANSFER"} onChange={() => setType("BANK_TRANSFER")} className="sr-only" />
            Bank transfer
          </label>
        </div>
      </fieldset>

      {type === "MOBILE_MONEY" ? (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="momoAccountName">
            Account name
            <input id="momoAccountName" name="momoAccountName" type="text" required defaultValue={existing?.momoAccountName ?? ""} className="rounded-lg border border-stone-300 px-3 py-2.5 text-base" disabled={isPending} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="momoPhone">
            Mobile Money number
            <input id="momoPhone" name="momoPhone" type="tel" required placeholder="024 123 4567" className="rounded-lg border border-stone-300 px-3 py-2.5 text-base" disabled={isPending} />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-stone-700">Network</legend>
            <div className="grid grid-cols-3 gap-2">
              {NETWORKS.map((n) => (
                <label key={n.value} className="flex cursor-pointer items-center justify-center rounded-lg border border-stone-300 px-2 py-2 text-xs font-medium text-stone-700 has-[:checked]:border-stone-800 has-[:checked]:bg-stone-900 has-[:checked]:text-white">
                  <input type="radio" name="momoNetwork" value={n.value} defaultChecked={existing?.momoNetwork === n.value} required className="sr-only" />
                  {n.label}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="bankAccountName">
            Account name
            <input id="bankAccountName" name="bankAccountName" type="text" required defaultValue={existing?.bankAccountName ?? ""} className="rounded-lg border border-stone-300 px-3 py-2.5 text-base" disabled={isPending} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="bankName">
            Bank name
            <input id="bankName" name="bankName" type="text" required defaultValue={existing?.bankName ?? ""} className="rounded-lg border border-stone-300 px-3 py-2.5 text-base" disabled={isPending} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-700" htmlFor="bankAccountNumber">
            Account number
            <input id="bankAccountNumber" name="bankAccountNumber" type="text" required className="rounded-lg border border-stone-300 px-3 py-2.5 text-base" disabled={isPending} />
          </label>
        </>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Saving…" : "Save payout details"}
      </Button>
      <p className="text-xs text-stone-500">Only the account owner can change payout details. Changes apply to future settlements only.</p>
    </form>
  );
}
