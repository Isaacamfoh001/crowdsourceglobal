"use client";

import { useActionState } from "react";
import { createOrderFromQuoteAction } from "../../lib/actions/quotation";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { DeliveryAddressFields } from "./DeliveryAddressFields";
import type { AddressView } from "../../modules/addresses/types";

export function QuoteCheckoutForm({ quotationId, addresses }: { quotationId: string; addresses: AddressView[] }) {
  const [state, formAction, isPending] = useActionState(createOrderFromQuoteAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="quotationId" value={quotationId} />

      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <DeliveryAddressFields addresses={addresses} disabled={isPending} />

      <Button type="submit" size="lg" fullWidth disabled={isPending} className="mt-2">
        {isPending ? "Placing order…" : "Place order"}
      </Button>
    </form>
  );
}
