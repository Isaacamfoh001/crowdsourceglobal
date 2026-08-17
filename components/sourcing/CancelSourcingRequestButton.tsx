"use client";

import { useActionState } from "react";
import { cancelSourcingRequestAction } from "../../lib/actions/sourcing";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";

export function CancelSourcingRequestButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(cancelSourcingRequestAction, null);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Cancelling…" : "Cancel request"}
        </Button>
      </form>
      {state && !state.ok ? (
        <div className="mt-2">
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      ) : null}
    </div>
  );
}
