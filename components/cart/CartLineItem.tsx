"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { updateCartItemQuantityAction, removeCartItemAction } from "../../lib/actions/cart";
import { ListingImagePlaceholder } from "../catalogue/ListingImagePlaceholder";
import { formatPrice } from "../../lib/format";
import type { CartLineView } from "../../modules/cart/types";

export function CartLineItem({ line }: { line: CartLineView }) {
  const [quantity, setQuantity] = useState(line.quantity);
  const [updateState, updateAction, updatePending] = useActionState(
    updateCartItemQuantityAction,
    null,
  );
  const [, removeAction, removePending] = useActionState(removeCartItemAction, null);

  const maxSelectable = Math.min(line.maxOq ?? line.availableQuantity, line.availableQuantity);
  const dirty = quantity !== line.quantity;

  return (
    <div className="flex flex-wrap gap-4 border-b border-stone-100 py-5 last:border-0">
      <Link href={`/listings/${line.listingId}`} className="shrink-0">
        <ListingImagePlaceholder categorySlug={line.categorySlug} className="size-16 rounded-xl sm:size-20" />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/listings/${line.listingId}`}
          className="line-clamp-2 font-display text-[15px] font-medium text-stone-900 hover:text-brand-800"
        >
          {line.title}
        </Link>
        <p className="mt-1 text-sm text-stone-500">
          {formatPrice(line.unitPrice, line.currency)} / unit
          {line.hasBulkPricing ? (
            <span className="ml-2 text-xs font-medium text-gold-700">Bulk pricing applied</span>
          ) : null}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <form action={updateAction} className="flex items-center gap-2">
              <input type="hidden" name="cartItemId" value={line.id} />
              <input type="hidden" name="quantity" value={quantity} />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(line.moq, q - 1))}
                disabled={quantity <= line.moq}
                aria-label="Decrease quantity"
                className="flex size-8 items-center justify-center rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="size-3.5" />
              </button>
              <input
                type="number"
                value={quantity}
                min={line.moq}
                max={maxSelectable}
                onChange={(event) => setQuantity(Number(event.target.value) || line.moq)}
                aria-label="Quantity"
                className="w-14 rounded-lg border border-stone-300 py-1.5 text-center text-sm font-medium text-stone-900"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxSelectable, q + 1))}
                disabled={quantity >= maxSelectable}
                aria-label="Increase quantity"
                className="flex size-8 items-center justify-center rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="size-3.5" />
              </button>
              {dirty ? (
                <button
                  type="submit"
                  disabled={updatePending}
                  className="text-sm font-medium text-brand-700 hover:underline disabled:opacity-50"
                >
                  {updatePending ? "Updating…" : "Update"}
                </button>
              ) : null}
            </form>

            <form action={removeAction}>
              <input type="hidden" name="cartItemId" value={line.id} />
              <button
                type="submit"
                disabled={removePending}
                aria-label={`Remove ${line.title}`}
                className="flex items-center gap-1 text-sm text-stone-400 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            </form>
          </div>

          <p className="text-right text-[15px] font-semibold text-stone-900">
            {formatPrice(line.lineTotal, line.currency)}
          </p>
        </div>

        {updateState && !updateState.ok ? (
          <p className="mt-2 text-sm text-red-600">{updateState.error}</p>
        ) : null}
      </div>
    </div>
  );
}
