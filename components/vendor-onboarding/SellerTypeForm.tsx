"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
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
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 p-4 transition-colors has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
          >
            <input
              type="radio"
              name="sellerType"
              value={type.value}
              defaultChecked={initialValue === type.value}
              className="mt-1 size-4 accent-brand-700"
              required
            />
            <span>
              <span className="block text-[15px] font-medium text-stone-900">{type.label}</span>
              <span className="block text-sm text-stone-500">{type.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Button type="submit" size="lg" fullWidth disabled={isPending} className="mt-2">
        {isPending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
