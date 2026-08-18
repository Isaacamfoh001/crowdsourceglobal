"use client";

import { useActionState } from "react";
import { createOrderAction } from "../../lib/actions/checkout";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { DeliveryAddressFields } from "./DeliveryAddressFields";
import type { AddressView } from "../../modules/addresses/types";

export function CheckoutForm({ addresses }: { addresses: AddressView[] }) {
  const [state, formAction, isPending] = useActionState(createOrderAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <DeliveryAddressFields addresses={addresses} disabled={isPending} />

      <Button type="submit" size="lg" fullWidth disabled={isPending} className="mt-2">
        {isPending ? "Placing order…" : "Place order"}
      </Button>
    </form>
  );
}
