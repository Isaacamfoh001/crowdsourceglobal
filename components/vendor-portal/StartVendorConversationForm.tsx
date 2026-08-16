"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { startVendorConversationAction } from "../../lib/actions/messaging";

export function StartVendorConversationForm() {
  const [state, formAction, isPending] = useActionState(startVendorConversationAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <textarea
        name="body"
        rows={2}
        required
        placeholder="Ask us anything about running your store…"
        disabled={isPending}
        className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
