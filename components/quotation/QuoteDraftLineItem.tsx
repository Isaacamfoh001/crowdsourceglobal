"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2, TriangleAlert } from "lucide-react";
import { updateQuoteDraftLineAction, removeQuoteDraftLineAction } from "../../lib/actions/quotation";
import { formatPrice } from "../../lib/format";
import type { QuoteDraftLineView } from "../../modules/quotation/types";

export function QuoteDraftLineItem({ line }: { line: QuoteDraftLineView }) {
  const [quantity, setQuantity] = useState(line.quantity);
  const [, updateAction, updatePending] = useActionState(updateQuoteDraftLineAction, null);
  const [, removeAction, removePending] = useActionState(removeQuoteDraftLineAction, null);

  const dirty = quantity !== line.quantity;

  return (
    <div className="flex flex-col gap-3 border-b border-ivory-100 py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-espresso-900/35">
          {line.vendor.companyName}
        </p>
        <Link
          href={`/listings/${line.listingId}`}
          className="line-clamp-2 font-display text-[15px] font-medium text-espresso-950 hover:text-forest-900"
        >
          {line.title}
        </Link>
        {!line.stillEligible ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-danger-600">
            <TriangleAlert className="size-3.5" strokeWidth={2} />
            No longer available — remove this line before generating your quote.
          </p>
        ) : (
          <p className="mt-1 text-sm text-espresso-900/50">{formatPrice(line.unitPrice, line.currency)} / unit</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <form action={updateAction} className="flex items-center gap-2">
            <input type="hidden" name="listingId" value={line.listingId} />
            <input type="hidden" name="quantity" value={quantity} />
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(line.moq, q - 1))}
              disabled={quantity <= line.moq}
              aria-label="Decrease quantity"
              className="flex size-8 items-center justify-center rounded-lg border border-ivory-400 text-espresso-800 hover:bg-ivory-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
            <input
              type="number"
              value={quantity}
              min={line.moq}
              onChange={(event) => setQuantity(Number(event.target.value) || line.moq)}
              aria-label={`Quantity for ${line.title}`}
              className="w-16 rounded-lg border border-ivory-400 py-1.5 text-center text-sm font-medium text-espresso-950"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase quantity"
              className="flex size-8 items-center justify-center rounded-lg border border-ivory-400 text-espresso-800 hover:bg-ivory-50"
            >
              <Plus className="size-3.5" />
            </button>
            {dirty ? (
              <button
                type="submit"
                disabled={updatePending}
                className="text-sm font-medium text-forest-800 hover:underline disabled:opacity-50"
              >
                {updatePending ? "Updating…" : "Update"}
              </button>
            ) : null}
          </form>

          <form action={removeAction}>
            <input type="hidden" name="listingId" value={line.listingId} />
            <button
              type="submit"
              disabled={removePending}
              aria-label={`Remove ${line.title}`}
              className="flex items-center gap-1 text-sm text-espresso-900/35 hover:text-danger-600 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          </form>
        </div>
      </div>

      <p className="text-right text-[15px] font-semibold text-espresso-950 sm:w-28">
        {formatPrice(line.lineTotal, line.currency)}
      </p>
    </div>
  );
}
