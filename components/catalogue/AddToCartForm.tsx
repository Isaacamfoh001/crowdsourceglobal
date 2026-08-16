"use client";

import { useActionState, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { addToCartAction } from "../../lib/actions/cart";
import { resolveUnitPrice } from "../../modules/pricing/resolveUnitPrice";
import { formatPrice } from "../../lib/format";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import type { PublicBulkPriceTier } from "../../modules/pricing/types";

export function AddToCartForm({
  listingId,
  currentPath,
  basePrice,
  currency,
  moq,
  maxOq,
  availableQuantity,
  availabilityStatus,
  bulkPriceTiers,
}: {
  listingId: string;
  currentPath: string;
  basePrice: number;
  currency: string;
  moq: number;
  maxOq: number | null;
  availableQuantity: number;
  availabilityStatus: string;
  bulkPriceTiers: PublicBulkPriceTier[];
}) {
  const maxSelectable = Math.max(moq, Math.min(maxOq ?? availableQuantity, availableQuantity));
  const outOfStock = availabilityStatus === "OUT_OF_STOCK" || availableQuantity < moq;

  const [quantity, setQuantity] = useState(moq);
  const [state, formAction, isPending] = useActionState(addToCartAction, null);

  // Preview only — the authoritative price is always recalculated
  // server-side in addToCartAction against freshly-read tiers.
  const previewUnitPrice = resolveUnitPrice(basePrice, bulkPriceTiers, quantity);
  const previewTotal = previewUnitPrice * quantity;

  function clamp(next: number) {
    return Math.max(moq, Math.min(maxSelectable, next));
  }

  if (outOfStock) {
    return (
      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
        <Button size="lg" fullWidth disabled>
          Currently unavailable
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="currentPath" value={currentPath} />
      <input type="hidden" name="quantity" value={quantity} />

      <div className="flex items-center justify-between gap-4">
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
              aria-label="Quantity"
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

        <div className="text-right">
          <p className="text-sm font-medium text-stone-500">
            {formatPrice(previewUnitPrice, currency)} / unit
          </p>
          <p className="text-2xl font-semibold text-stone-900">
            {formatPrice(previewTotal, currency)}
          </p>
        </div>
      </div>

      {state && !state.ok ? (
        <div className="mt-4">
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      ) : null}
      {state && state.ok ? (
        <div className="mt-4">
          <FormMessage tone="success">Added to your cart.</FormMessage>
        </div>
      ) : null}

      <Button type="submit" size="lg" fullWidth className="mt-4" disabled={isPending}>
        {isPending ? "Adding…" : "Add to Cart"}
      </Button>
    </form>
  );
}
