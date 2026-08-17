"use client";

import { useActionState } from "react";
import { addResolutionAttachmentAction } from "../../lib/actions/resolutions";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";

export function AddEvidenceForm({ caseId }: { caseId: string }) {
  const [state, formAction, isPending] = useActionState(addResolutionAttachmentAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <input
        type="file"
        name="evidence"
        required
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Uploading…" : "Upload"}
      </Button>
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
    </form>
  );
}
