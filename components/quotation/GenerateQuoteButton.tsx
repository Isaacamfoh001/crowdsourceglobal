"use client";

import { useActionState } from "react";
import { generateQuoteAction } from "../../lib/actions/quotation";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";

export function GenerateQuoteButton({ disabled }: { disabled: boolean }) {
  const [state, formAction, isPending] = useActionState(generateQuoteAction, null);

  return (
    <div className="flex-1">
      <form action={formAction}>
        <Button type="submit" size="lg" fullWidth disabled={disabled || isPending}>
          {isPending ? "Generating…" : "Generate Quote"}
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
