"use client";

import { useActionState, useState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import {
  confirmCollectionAction,
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

/**
 * (M11.1) One primary action — replaces the old "Save collection details"
 * then separately "Confirm collected" two-step, which risked an admin
 * believing the operation was done after just saving. This validates,
 * persists, and transitions to COLLECTED atomically (see
 * modules/fulfilment/repository.ts's confirmCollectionTransactional).
 */
export function ConfirmCollectionForm({ fulfilmentId }: { fulfilmentId: string }) {
  const [state, formAction, isPending] = useActionState(confirmCollectionAction, null);
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
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-stone-700">
          Notes (optional)
        </label>
        <textarea id="notes" name="notes" rows={2} disabled={isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Confirming…" : "Confirm collection"}
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

/**
 * Renders exactly ONE action — the single valid next progression step for
 * the shipment's current status — never all three at once (M11.1: an admin
 * must always be able to tell what the one right next action is). The
 * backend already rejects a skipped transition via its own guarded
 * updateMany (see modules/fulfilment/repository.ts's progressShipment); this
 * only controls what's offered, and now surfaces a rejection if one somehow
 * still occurs (e.g. a stale page, another admin acting concurrently).
 */
export function ProgressButtons({ fulfilmentId, shipmentStatus }: { fulfilmentId: string; shipmentStatus: string }) {
  const nextAction =
    shipmentStatus === "COLLECTED"
      ? { action: progressToInTransitAction, label: "Mark in transit" }
      : shipmentStatus === "IN_TRANSIT"
        ? { action: progressToOutForDeliveryAction, label: "Mark out for delivery" }
        : shipmentStatus === "OUT_FOR_DELIVERY"
          ? { action: confirmDeliveredAction, label: "Confirm delivered" }
          : null;

  const [state, formAction, isPending] = useActionState(nextAction?.action ?? progressToInTransitAction, null);
  if (!nextAction) return null;

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : nextAction.label}
      </Button>
    </form>
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
