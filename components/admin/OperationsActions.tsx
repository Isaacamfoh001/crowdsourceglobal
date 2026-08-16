"use client";

import { useActionState, useState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import {
  scheduleCollectionAction,
  confirmCollectedAction,
  progressToInTransitAction,
  progressToOutForDeliveryAction,
  confirmDeliveredAction,
  reportDeliveryFailedAction,
  resumeAfterFailureAction,
  resolveIssueAction,
  assignReceivingLocationAction,
} from "../../lib/actions/fulfilment";

export function AssignReceivingLocationForm({
  fulfilmentId,
  locations,
  currentLocationId,
}: {
  fulfilmentId: string;
  locations: { id: string; name: string }[];
  currentLocationId?: string;
}) {
  const [state, formAction, isPending] = useActionState(assignReceivingLocationAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="receivingLocationId" className="text-sm font-medium text-stone-700">
          Receiving destination
        </label>
        <select
          id="receivingLocationId"
          name="receivingLocationId"
          defaultValue={currentLocationId ?? ""}
          disabled={isPending}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Select a location
          </option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Assign"}
      </Button>
    </form>
  );
}

export function ScheduleCollectionForm({ fulfilmentId }: { fulfilmentId: string }) {
  const [state, formAction, isPending] = useActionState(scheduleCollectionAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="carrier" className="text-sm font-medium text-stone-700">
            Courier / provider
          </label>
          <input id="carrier" name="carrier" disabled={isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="trackingReference" className="text-sm font-medium text-stone-700">
            Pickup reference
          </label>
          <input
            id="trackingReference"
            name="trackingReference"
            disabled={isPending}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="scheduledAt" className="text-sm font-medium text-stone-700">
            Scheduled pickup
          </label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            disabled={isPending}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-stone-700">
          Notes (optional)
        </label>
        <textarea id="notes" name="notes" rows={2} disabled={isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save collection details"}
      </Button>
    </form>
  );
}

export function ConfirmCollectedButton({ fulfilmentId, label }: { fulfilmentId: string; label: string }) {
  return (
    <form action={confirmCollectedAction}>
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      <Button type="submit" size="sm">
        {label}
      </Button>
    </form>
  );
}

export function ProgressButtons({ fulfilmentId }: { fulfilmentId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={progressToInTransitAction}>
        <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
        <Button type="submit" size="sm" variant="outline">
          Mark in transit
        </Button>
      </form>
      <form action={progressToOutForDeliveryAction}>
        <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
        <Button type="submit" size="sm" variant="outline">
          Mark out for delivery
        </Button>
      </form>
      <form action={confirmDeliveredAction}>
        <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
        <Button type="submit" size="sm">
          Confirm delivered
        </Button>
      </form>
    </div>
  );
}

export function ReportFailureForm({ fulfilmentId }: { fulfilmentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(reportDeliveryFailedAction, null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-red-600 underline">
        Report failed delivery
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <textarea name="notes" rows={2} required disabled={isPending} placeholder="What happened?" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={isPending} className="border-red-300 text-red-700">
          {isPending ? "Saving…" : "Confirm"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ResumeAfterFailureButton({ fulfilmentId }: { fulfilmentId: string }) {
  return (
    <form action={resumeAfterFailureAction}>
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      <Button type="submit" size="sm" variant="outline">
        Resume delivery attempt
      </Button>
    </form>
  );
}

export function ResolveIssueForm({ fulfilmentId, issueId }: { fulfilmentId: string; issueId: string }) {
  const [state, formAction, isPending] = useActionState(resolveIssueAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      <input type="hidden" name="issueId" value={issueId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <textarea
        name="resolutionNotes"
        rows={2}
        required
        disabled={isPending}
        placeholder="How was this resolved? (the vendor will see this note)"
        className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Resolving…" : "Resolve — resume preparation"}
      </Button>
    </form>
  );
}
