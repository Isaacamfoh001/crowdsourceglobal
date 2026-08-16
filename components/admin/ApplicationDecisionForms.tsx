"use client";

import { useActionState } from "react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import {
  approveApplicationAction,
  requestApplicationChangesAction,
  rejectApplicationAction,
} from "../../lib/actions/admin";

export function ApplicationDecisionForms({ applicationId }: { applicationId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(approveApplicationAction, null);
  const [changesState, changesAction, changesPending] = useActionState(requestApplicationChangesAction, null);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectApplicationAction, null);
  const [mode, setMode] = useState<"none" | "changes" | "reject">("none");

  return (
    <div className="flex flex-col gap-4">
      {approveState && !approveState.ok ? <FormMessage tone="error">{approveState.error}</FormMessage> : null}

      <form action={approveAction}>
        <input type="hidden" name="applicationId" value={applicationId} />
        <Button type="submit" size="lg" disabled={approvePending} className="w-full sm:w-auto">
          {approvePending ? "Approving…" : "Approve application"}
        </Button>
      </form>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setMode(mode === "changes" ? "none" : "changes")}
          className="text-sm font-medium text-stone-600 underline decoration-stone-300 hover:text-stone-900"
        >
          Request changes
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "reject" ? "none" : "reject")}
          className="text-sm font-medium text-red-600 underline decoration-red-200 hover:text-red-800"
        >
          Reject
        </button>
      </div>

      {mode === "changes" ? (
        <form action={changesAction} className="flex flex-col gap-2 rounded-xl border border-stone-200 p-4">
          <input type="hidden" name="applicationId" value={applicationId} />
          {changesState && !changesState.ok ? <FormMessage tone="error">{changesState.error}</FormMessage> : null}
          <label htmlFor="changesReason" className="text-sm font-medium text-stone-700">
            What needs to change?
          </label>
          <textarea
            id="changesReason"
            name="reason"
            rows={3}
            required
            className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm"
          />
          <Button type="submit" variant="outline" disabled={changesPending} className="w-fit">
            {changesPending ? "Sending…" : "Send back for changes"}
          </Button>
        </form>
      ) : null}

      {mode === "reject" ? (
        <form action={rejectAction} className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <input type="hidden" name="applicationId" value={applicationId} />
          {rejectState && !rejectState.ok ? <FormMessage tone="error">{rejectState.error}</FormMessage> : null}
          <label htmlFor="rejectReason" className="text-sm font-medium text-stone-700">
            Reason for rejection
          </label>
          <textarea
            id="rejectReason"
            name="reason"
            rows={3}
            required
            className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm"
          />
          <Button type="submit" variant="outline" disabled={rejectPending} className="w-fit border-red-300 text-red-700">
            {rejectPending ? "Sending…" : "Confirm rejection"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
