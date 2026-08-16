"use client";

import { useActionState } from "react";
import { createOrderAction } from "../../lib/actions/checkout";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import { GHANA_REGIONS } from "../../modules/orders/types";

export function CheckoutForm() {
  const [state, formAction, isPending] = useActionState(createOrderAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <Input label="Recipient name" name="recipientName" autoComplete="name" required disabled={isPending} />
      <Input
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="024 123 4567"
        required
        disabled={isPending}
      />
      <Input
        label="Delivery address"
        name="addressLine1"
        autoComplete="address-line1"
        placeholder="Street, house number, landmark"
        required
        disabled={isPending}
      />
      <Input
        label="Additional address details (optional)"
        name="addressLine2"
        autoComplete="address-line2"
        disabled={isPending}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="City / Town" name="city" autoComplete="address-level2" required disabled={isPending} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="region" className="text-sm font-medium text-stone-700">
            Region
          </label>
          <select
            id="region"
            name="region"
            required
            disabled={isPending}
            defaultValue=""
            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          >
            <option value="" disabled>
              Select region
            </option>
            {GHANA_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-stone-700">
          Delivery notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          disabled={isPending}
          placeholder="Gate code, preferred delivery time, etc."
          className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <Button type="submit" size="lg" fullWidth disabled={isPending} className="mt-2">
        {isPending ? "Placing order…" : "Place order"}
      </Button>
    </form>
  );
}
