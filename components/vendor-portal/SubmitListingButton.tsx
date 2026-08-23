"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { submitListingAction, toggleActiveAction } from "../../lib/actions/vendor-listings";

export function SubmitListingButton({ listingId, label }: { listingId: string; label: string }) {
  const [state, formAction, isPending] = useActionState(submitListingAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="listingId" value={listingId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending ? "Submitting…" : label}
      </Button>
    </form>
  );
}

export function ToggleActiveButton({ listingId, active }: { listingId: string; active: boolean }) {
  return (
    <form action={toggleActiveAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        type="submit"
        className="text-sm font-medium text-espresso-900/65 underline decoration-ivory-400 hover:text-espresso-950"
      >
        {active ? "Hide from marketplace" : "Show on marketplace"}
      </button>
    </form>
  );
}
