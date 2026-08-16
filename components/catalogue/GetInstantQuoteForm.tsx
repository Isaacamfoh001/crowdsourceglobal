"use client";

import { useActionState, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { addToQuoteDraftAction } from "../../lib/actions/quotation";
import { resolveUnitPrice } from "../../modules/pricing/resolveUnitPrice";
import { formatPrice } from "../../lib/format";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import type { PublicBulkPriceTier } from "../../modules/pricing/types";

export function GetInstantQuoteForm({
  listingId,
  currentPath,
  basePrice,
  currency,
  moq,
  maxOq,
  availableQuantity,
  bulkPriceTiers,
  resumedQuantity,
}: {
  listingId: string;
  currentPath: string;
  basePrice: number;
  currency: string;
  moq: number;
  maxOq: number | null;
  availableQuantity: number;
  bulkPriceTiers: PublicBulkPriceTier[];
  resumedQuantity: number | null;
}) {
  const maxSelectable = Math.max(moq, Math.min(maxOq ?? availableQuantity, availableQuantity));

  const [quantity, setQuantity] = useState(
    resumedQuantity ? Math.max(moq, Math.min(maxSelectable, resumedQuantity)) : moq,
  );
  const [state, formAction, isPending] = useActionState(addToQuoteDraftAction, null);

  const previewUnitPrice = resolveUnitPrice(basePrice, bulkPriceTiers, quantity);
  const previewTotal = previewUnitPrice * quantity;

  function clamp(next: number) {
    return Math.max(moq, Math.min(maxSelectable, next));
  }

  return (
    <form action={formAction} className="mt-4 rounded-2xl border border-gold-200 bg-gold-50/40 p-5">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="currentPath" value={currentPath} />
      <input type="hidden" name="quantity" value={quantity} />

      <p className="text-sm font-medium text-stone-700">
        {resumedQuantity ? (
          <>Picking up where you left off — request an instant quote for a bulk quantity.</>
        ) : (
          <>Ordering in bulk? Get an instant quotation with locked-in pricing.</>
        )}
      </p>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">Quantity</p>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => clamp(q - 1))}
              disabled={quantity <= moq}
              aria-label="Decrease quantity"
              className="flex size-9 items-center justify-center rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <input
              type="number"
              value={quantity}
              min={moq}
              max={maxSelectable}
              onChange={(event) => setQuantity(clamp(Number(event.target.value) || moq))}
              className="w-16 rounded-lg border border-stone-300 py-2 text-center text-sm font-medium text-stone-900"
              aria-label="Quantity for instant quote"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => clamp(q + 1))}
              disabled={quantity >= maxSelectable}
              aria-label="Increase quantity"
              className="flex size-9 items-center justify-center rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-sm font-medium text-stone-500">
            {formatPrice(previewUnitPrice, currency)} / unit
          </p>
          <p className="text-xl font-semibold text-stone-900">{formatPrice(previewTotal, currency)}</p>
        </div>
      </div>

      {state && !state.ok ? (
        <div className="mt-4">
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      ) : null}

      <Button type="submit" variant="outline" size="lg" fullWidth className="mt-4" disabled={isPending}>
        {isPending ? "Adding to quote…" : "Get Instant Quote"}
      </Button>
    </form>
  );
}
