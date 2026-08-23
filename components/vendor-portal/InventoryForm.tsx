"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { updateInventoryAction } from "../../lib/actions/vendor-listings";

const AVAILABILITY_OPTIONS = [
  { value: "IN_STOCK", label: "In stock" },
  { value: "LOW_STOCK", label: "Low stock" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
  { value: "MADE_TO_ORDER", label: "Made to order" },
];

export function InventoryForm({
  listingId,
  availableQuantity,
  availabilityStatus,
}: {
  listingId: string;
  availableQuantity: number;
  availabilityStatus: string;
}) {
  const [state, formAction, isPending] = useActionState(updateInventoryAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="listingId" value={listingId} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state && state.ok ? <FormMessage tone="success">Inventory updated.</FormMessage> : null}

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="availableQuantity" className="text-sm font-medium text-espresso-800">
            Available quantity
          </label>
          <input
            id="availableQuantity"
            name="availableQuantity"
            type="number"
            min={0}
            defaultValue={availableQuantity}
            className="w-32 rounded-lg border border-ivory-400 px-3 py-2 text-sm"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="availabilityStatus" className="text-sm font-medium text-espresso-800">
            Status
          </label>
          <select
            id="availabilityStatus"
            name="availabilityStatus"
            defaultValue={availabilityStatus}
            disabled={isPending}
            className="rounded-lg border border-ivory-400 px-3 py-2 text-sm"
          >
            {AVAILABILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Updating…" : "Update"}
        </Button>
      </div>
      <p className="text-xs text-espresso-900/50">
        Inventory updates apply immediately — no review needed.
      </p>
    </form>
  );
}
