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
      <div className="mt-8 border border-ivory-400 bg-ivory-100 p-5">
        <Button size="lg" fullWidth disabled>
          Currently unavailable
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 border border-ivory-400 bg-ivory-100 p-6">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="currentPath" value={currentPath} />
      <input type="hidden" name="quantity" value={quantity} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-espresso-900/50">Quantity</p>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => clamp(q - 1))}
              disabled={quantity <= moq}
              aria-label="Decrease quantity"
              className="flex size-9 items-center justify-center border border-ivory-400 bg-ivory-50 text-espresso-900 hover:bg-ivory-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <input
              type="number"
              value={quantity}
              min={moq}
              max={maxSelectable}
              onChange={(event) => setQuantity(clamp(Number(event.target.value) || moq))}
              className="w-16 border border-ivory-400 bg-ivory-50 py-2 text-center text-sm font-medium text-espresso-950"
              aria-label="Quantity"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => clamp(q + 1))}
              disabled={quantity >= maxSelectable}
              aria-label="Increase quantity"
              className="flex size-9 items-center justify-center border border-ivory-400 bg-ivory-50 text-espresso-900 hover:bg-ivory-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-sm font-medium text-espresso-900/50">
            {formatPrice(previewUnitPrice, currency)} / unit
          </p>
          <p className="font-display text-2xl font-semibold text-espresso-950">
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

      <Button
        type="submit"
        size="lg"
        fullWidth
        className="mt-5 !bg-champagne-400 !text-espresso-950 shadow-none hover:!bg-champagne-300"
        disabled={isPending}
      >
        {isPending ? "Adding…" : "Add to Cart"}
      </Button>
    </form>
  );
}
