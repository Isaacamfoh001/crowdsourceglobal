"use client";

import { useActionState } from "react";
import { FormMessage } from "../ui/FormMessage";
import { StepActions } from "./StepActions";
import { saveSellerTypeAction } from "../../lib/actions/vendor-application";
import { SELLER_TYPES, type SellerType } from "../../modules/vendor-applications/types";

export function SellerTypeForm({ initialValue }: { initialValue: SellerType | null }) {
  const [state, formAction, isPending] = useActionState(saveSellerTypeAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Seller type</legend>
        {SELLER_TYPES.map((type) => (
          <label
            key={type.value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-ivory-300 p-4 transition-colors has-[:checked]:border-espresso-800 has-[:checked]:bg-champagne-200/20"
          >
            <input
              type="radio"
              name="sellerType"
              value={type.value}
              defaultChecked={initialValue === type.value}
              className="mt-1 size-4 accent-espresso-800"
              required
            />
            <span>
              <span className="block text-[15px] font-medium text-espresso-950">{type.label}</span>
              <span className="block text-sm text-espresso-900/50">{type.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <StepActions submitLabel="Continue" pendingLabel="Saving…" isPending={isPending} />
    </form>
  );
}
