"use client";

import { useActionState, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { startVendorResolutionConversationAction } from "../../lib/actions/messaging";

export function AskVendorResolutionButton({ caseId, label }: { caseId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(startVendorResolutionConversationAction, null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-espresso-800 hover:underline">
        <MessageCircle className="size-4" strokeWidth={1.75} />
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-ivory-300 bg-ivory-50 p-4">
      <input type="hidden" name="caseId" value={caseId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <textarea
        name="body"
        rows={2}
        required
        placeholder="Share any relevant details…"
        disabled={isPending}
        className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Sending…" : "Send"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-espresso-900/35">This goes to CrownSourceGlobal, not directly to the customer.</p>
    </form>
  );
}
