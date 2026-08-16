"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import { createReceivingLocationAction } from "../../lib/actions/logistics";

export function ReceivingLocationForm() {
  const [state, formAction, isPending] = useActionState(createReceivingLocationAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <Input label="Name" name="name" placeholder="e.g. CrownSourceGlobal Accra Office" required disabled={isPending} />
      <Input label="Type (optional)" name="type" placeholder="office / warehouse / consolidation" disabled={isPending} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input label="Country" name="country" defaultValue="Ghana" required disabled={isPending} />
        <Input label="Region" name="region" disabled={isPending} />
        <Input label="City" name="city" disabled={isPending} />
      </div>
      <Input label="Address" name="addressLine1" required disabled={isPending} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Contact name (optional)" name="contactName" disabled={isPending} />
        <Input label="Contact phone (optional)" name="contactPhone" disabled={isPending} />
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Adding…" : "Add location"}
      </Button>
    </form>
  );
}
