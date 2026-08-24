"use client";

import { useActionState, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import {
  startContextualConversationAction,
  stashMessageIntentAction,
} from "../../lib/actions/messaging";

export function AskAboutButton({
  contextType,
  contextRefId,
  currentPath,
  isSignedIn,
  resumedBody,
  label,
  placeholder,
}: {
  contextType: "LISTING" | "VENDOR" | "ORDER" | "SOURCING_REQUEST" | "RESOLUTION_CASE";
  contextRefId: string;
  currentPath: string;
  isSignedIn: boolean;
  /** A message the visitor typed before being sent to sign in — see stashMessageIntentAction. */
  resumedBody?: string | null;
  label: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(Boolean(resumedBody));
  // Bound once per mount, not switched dynamically — isSignedIn only
  // changes via a full page reload (sign-in redirect), never mid-session.
  const action = isSignedIn ? startContextualConversationAction : stashMessageIntentAction;
  const [state, formAction, isPending] = useActionState(action, null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-800 hover:underline"
      >
        <MessageCircle className="size-4" strokeWidth={1.75} />
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-ivory-300 bg-ivory-50 p-4">
      <input type="hidden" name="contextType" value={contextType} />
      <input type="hidden" name="contextRefId" value={contextRefId} />
      <input type="hidden" name="currentPath" value={currentPath} />
      <p className="text-sm font-medium text-espresso-800">Ask CrownSourceGlobal</p>
      {resumedBody ? (
        <FormMessage tone="success">
          Continuing the message you started before signing in — review it and send.
        </FormMessage>
      ) : null}
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <textarea
        name="body"
        rows={2}
        required
        defaultValue={resumedBody ?? ""}
        placeholder={placeholder}
        disabled={isPending}
        className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Sending…" : isSignedIn ? "Send" : "Sign in to send"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-espresso-900/35">
        {isSignedIn
          ? "This goes to CrownSourceGlobal, not directly to the vendor."
          : "You'll sign in first, then this message goes to CrownSourceGlobal — not directly to the vendor."}
      </p>
    </form>
  );
}
