"use client";

import { useActionState } from "react";
import { attemptMockPaymentAction } from "../../lib/actions/payment";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";

export function MockPaymentForm({ orderId, idempotencyKey }: { orderId: string; idempotencyKey: string }) {
  const [state, formAction, isPending] = useActionState(attemptMockPaymentAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <Button type="submit" name="outcome" value="succeed" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Processing…" : "Simulate Successful Payment"}
      </Button>
      <Button
        type="submit"
        name="outcome"
        value="fail"
        variant="outline"
        size="lg"
        fullWidth
        disabled={isPending}
      >
        Simulate Failed Payment
      </Button>
    </form>
  );
}
