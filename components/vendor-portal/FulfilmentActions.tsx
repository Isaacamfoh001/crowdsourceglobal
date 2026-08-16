"use client";

import { useActionState, useState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import {
  startPreparingAction,
  markReadyAction,
  reportFulfilmentIssueAction,
  recordVendorShipmentAction,
} from "../../lib/actions/fulfilment";

export function StartPreparingButton({ fulfilmentId }: { fulfilmentId: string }) {
  return (
    <form action={startPreparingAction}>
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      <Button type="submit" size="lg">
        Start preparing
      </Button>
    </form>
  );
}

export function MarkReadyButton({ fulfilmentId, international }: { fulfilmentId: string; international: boolean }) {
  return (
    <form action={markReadyAction}>
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      <Button type="submit" size="lg">
        {international ? "Mark ready to ship" : "Mark ready for collection"}
      </Button>
    </form>
  );
}

const ISSUE_CATEGORIES = [
  { value: "cannot_fulfil_quantity", label: "Can't fulfil the full quantity" },
  { value: "item_unavailable", label: "Item is unavailable" },
  { value: "preparation_delay", label: "Preparation is delayed" },
  { value: "damaged_stock", label: "Stock is damaged" },
  { value: "other", label: "Other" },
];

export function ReportIssueForm({ fulfilmentId }: { fulfilmentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(reportFulfilmentIssueAction, null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-red-600 underline decoration-red-200 hover:text-red-800"
      >
        Report an issue with this order
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium text-stone-700">
          What&apos;s the issue?
        </label>
        <select
          id="category"
          name="category"
          required
          disabled={isPending}
          defaultValue=""
          className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
        >
          <option value="" disabled>
            Select a reason
          </option>
          {ISSUE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-stone-700">
          Details
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          required
          disabled={isPending}
          className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
        />
      </div>
      <p className="text-xs text-stone-500">
        This pauses the order so CrownSourceGlobal operations can help resolve it.
      </p>
      <div className="flex gap-2">
        <Button type="submit" variant="outline" disabled={isPending} className="border-red-300 text-red-700">
          {isPending ? "Reporting…" : "Report issue"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RecordShipmentForm({ fulfilmentId }: { fulfilmentId: string }) {
  const [state, formAction, isPending] = useActionState(recordVendorShipmentAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="fulfilmentId" value={fulfilmentId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="carrier" className="text-sm font-medium text-stone-700">
            Carrier
          </label>
          <input
            id="carrier"
            name="carrier"
            required
            disabled={isPending}
            placeholder="e.g. DHL, FedEx"
            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="trackingReference" className="text-sm font-medium text-stone-700">
            Tracking reference
          </label>
          <input
            id="trackingReference"
            name="trackingReference"
            required
            disabled={isPending}
            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="shippedAt" className="text-sm font-medium text-stone-700">
            Ship date
          </label>
          <input
            id="shippedAt"
            name="shippedAt"
            type="date"
            required
            disabled={isPending}
            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="expectedArrivalAt" className="text-sm font-medium text-stone-700">
            Expected arrival (optional)
          </label>
          <input
            id="expectedArrivalAt"
            name="expectedArrivalAt"
            type="date"
            disabled={isPending}
            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
          />
        </div>
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Record shipment"}
      </Button>
    </form>
  );
}
