"use client";

import { useActionState, useState } from "react";
import { respondToSolicitationAction } from "../../lib/actions/vendor-sourcing";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { MoneyInput } from "../ui/MoneyInput";
import { FormMessage } from "../ui/FormMessage";
import type { Result } from "../../lib/result";

function ErrorMessage({ state }: { state: Result<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <div className="mt-2">
      <FormMessage tone="error">{state.error}</FormMessage>
    </div>
  );
}

/**
 * Part 4's "CAN FULFIL / CANNOT FULFIL" response — a one-time submission
 * (the solicitation moves out of SENT once answered, and this form never
 * renders again after that), so it uses the standard `<form action>` +
 * useActionState pattern like every other one-shot vendor-portal action —
 * no persisted-value-reset concern here (see SourcingActions.tsx's
 * AssignStaffForm for where that concern DOES apply).
 */
export function RespondToSolicitationForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(respondToSolicitationAction, null);
  const [mode, setMode] = useState<"choose" | "can-fulfil">("choose");

  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={() => setMode("can-fulfil")}>
            Can fulfil
          </Button>
          <form action={formAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="canFulfil" value="false" />
            <Button type="submit" size="lg" variant="outline" disabled={isPending}>
              {isPending ? "Sending…" : "Cannot fulfil"}
            </Button>
          </form>
        </div>
        <ErrorMessage state={state} />
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="canFulfil" value="true" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Available quantity" name="proposedQuantity" type="number" min={1} required disabled={isPending} />
        <MoneyInput label="Unit price" name="unitPrice" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Lead time (days)" name="leadTimeDays" type="number" min={0} disabled={isPending} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-espresso-800">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Anything CrownSourceGlobal should know about this proposal."
          disabled={isPending}
          className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Sending…" : "Submit response"}
        </Button>
        <Button type="button" size="lg" variant="ghost" disabled={isPending} onClick={() => setMode("choose")}>
          Back
        </Button>
      </div>
      <ErrorMessage state={state} />
    </form>
  );
}
