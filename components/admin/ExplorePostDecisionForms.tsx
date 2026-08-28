"use client";

import { useActionState } from "react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { approveExplorePostAction, requestExplorePostChangesAction, rejectExplorePostAction } from "../../lib/actions/admin";

/** Mirrors ListingDecisionForms.tsx exactly — same three-decision shape, targeting an Explore post instead of a listing (M21). */
export function ExplorePostDecisionForms({ postId, isEdit }: { postId: string; isEdit: boolean }) {
  const [approveState, approveAction, approvePending] = useActionState(approveExplorePostAction, null);
  const [changesState, changesAction, changesPending] = useActionState(requestExplorePostChangesAction, null);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectExplorePostAction, null);
  const [mode, setMode] = useState<"none" | "changes" | "reject">("none");

  return (
    <div className="flex flex-col gap-4">
      {approveState && !approveState.ok ? <FormMessage tone="error">{approveState.error}</FormMessage> : null}

      <form action={approveAction}>
        <input type="hidden" name="postId" value={postId} />
        <Button type="submit" size="lg" disabled={approvePending} className="w-full sm:w-auto">
          {approvePending ? "Approving…" : isEdit ? "Approve changes" : "Approve post"}
        </Button>
      </form>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setMode(mode === "changes" ? "none" : "changes")}
          className="text-sm font-medium text-espresso-900/65 underline decoration-ivory-400 hover:text-espresso-950"
        >
          Request changes
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "reject" ? "none" : "reject")}
          className="text-sm font-medium text-danger-600 underline decoration-danger-200 hover:text-danger-800"
        >
          {isEdit ? "Discard this edit" : "Reject"}
        </button>
      </div>

      {mode === "changes" ? (
        <form action={changesAction} className="flex flex-col gap-2 rounded-xl border border-ivory-300 p-4">
          <input type="hidden" name="postId" value={postId} />
          {changesState && !changesState.ok ? <FormMessage tone="error">{changesState.error}</FormMessage> : null}
          <label htmlFor="changesReason" className="text-sm font-medium text-espresso-800">
            What needs to change?
          </label>
          <textarea
            id="changesReason"
            name="reason"
            rows={3}
            required
            className="w-full rounded-lg border border-ivory-400 px-3.5 py-2.5 text-sm"
          />
          <Button type="submit" variant="outline" disabled={changesPending} className="w-fit">
            {changesPending ? "Sending…" : "Send back for changes"}
          </Button>
        </form>
      ) : null}

      {mode === "reject" ? (
        <form action={rejectAction} className="flex flex-col gap-2 rounded-xl border border-danger-200 bg-danger-50 p-4">
          <input type="hidden" name="postId" value={postId} />
          {rejectState && !rejectState.ok ? <FormMessage tone="error">{rejectState.error}</FormMessage> : null}
          <label htmlFor="rejectReason" className="text-sm font-medium text-espresso-800">
            {isEdit ? "Note (optional context, not shown to vendor for a discarded edit)" : "Reason for rejection"}
          </label>
          <textarea
            id="rejectReason"
            name="reason"
            rows={3}
            required
            className="w-full rounded-lg border border-ivory-400 px-3.5 py-2.5 text-sm"
          />
          <Button type="submit" variant="outline" disabled={rejectPending} className="w-fit border-danger-200 text-danger-700">
            {rejectPending ? "Sending…" : isEdit ? "Discard edit" : "Confirm rejection"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
