"use client";

import { useActionState, useState } from "react";
import { transitionTalentApplicationAction, addTalentApplicationNoteAction } from "../../lib/actions/talent";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { Textarea } from "../ui/Textarea";
import type { Result } from "../../lib/result";
import type { TalentCloseOutcome } from "../../modules/talent/types";

function ErrorMessage({ state }: { state: Result<unknown> | null }) {
  if (!state || state.ok) return null;
  return <FormMessage tone="error">{state.error}</FormMessage>;
}

function TransitionButton({
  id,
  nextStatus,
  label,
  pendingLabel,
  variant = "primary",
}: {
  id: string;
  nextStatus: string;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "outline";
}) {
  const [state, formAction, isPending] = useActionState(transitionTalentApplicationAction, null);
  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="nextStatus" value={nextStatus} />
      <Button type="submit" size="sm" variant={variant} disabled={isPending}>
        {isPending ? pendingLabel : label}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function StartReviewButton({ id }: { id: string }) {
  return <TransitionButton id={id} nextStatus="REVIEWING" label="Start review" pendingLabel="Starting…" />;
}

export function ShortlistButton({ id }: { id: string }) {
  return <TransitionButton id={id} nextStatus="SHORTLISTED" label="Shortlist" pendingLabel="Saving…" />;
}

export function MarkReferredButton({ id }: { id: string }) {
  return <TransitionButton id={id} nextStatus="REFERRED" label="Mark referred" pendingLabel="Saving…" />;
}

const CLOSE_OUTCOME_OPTIONS: { value: TalentCloseOutcome; label: string }[] = [
  { value: "PLACED", label: "Placed" },
  { value: "NOT_SELECTED", label: "Not selected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "OTHER", label: "Other" },
];

export function CloseApplicationForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(transitionTalentApplicationAction, null);
  const [outcome, setOutcome] = useState<TalentCloseOutcome>("NOT_SELECTED");

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="nextStatus" value="CLOSED" />
      <select
        name="closeOutcome"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as TalentCloseOutcome)}
        disabled={isPending}
        className="rounded-lg border border-ivory-400 bg-ivory-50 px-3 py-2 text-sm text-espresso-950 outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
      >
        {CLOSE_OUTCOME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Closing…" : "Close application"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function AddTalentNoteForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(addTalentApplicationNoteAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Textarea label="Add an internal note" id="note" name="note" rows={3} disabled={isPending} />
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Add note"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}
