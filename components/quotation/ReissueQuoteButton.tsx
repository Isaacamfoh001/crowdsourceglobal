"use client";

import { useActionState } from "react";
import { reissueQuoteAction } from "../../lib/actions/quotation";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";

export function ReissueQuoteButton({ quotationId }: { quotationId: string }) {
  const [state, formAction, isPending] = useActionState(reissueQuoteAction, null);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="quotationId" value={quotationId} />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Preparing…" : "Get Updated Quote"}
        </Button>
      </form>
      {state && !state.ok ? (
        <div className="mt-3">
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      ) : null}
    </div>
  );
}
