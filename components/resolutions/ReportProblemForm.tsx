"use client";

import { useActionState, useState } from "react";
import { submitResolutionCaseAction } from "../../lib/actions/resolutions";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { formatPrice } from "../../lib/format";
import type { OrderCancellationContext } from "../../modules/resolutions/types";

const ISSUE_TYPES: { value: string; label: string; hint?: string }[] = [
  { value: "CUSTOMER_CANCELLATION_REQUEST", label: "I want to cancel this", hint: "Only available before delivery." },
  { value: "ITEM_DAMAGED", label: "Item arrived damaged" },
  { value: "WRONG_ITEM", label: "I received the wrong item" },
  { value: "MISSING_ITEM", label: "An item is missing" },
  { value: "MISSING_QUANTITY", label: "I received fewer than I ordered" },
  { value: "ITEM_NOT_AS_DESCRIBED", label: "Item isn't as described" },
  { value: "PACKAGE_NOT_RECEIVED", label: "I never received my package" },
  { value: "DELIVERY_FAILURE", label: "There was a delivery problem" },
  { value: "OTHER", label: "Something else" },
];

const ELIGIBILITY_LABEL: Record<string, string> = {
  SAFE: "Not yet started — can usually be cancelled quickly",
  NEEDS_REVIEW: "Already in progress — needs CrownSource review",
  BLOCKED: "Already delivered — cancellation no longer applies",
};

export function ReportProblemForm({ context, defaultFulfilmentId }: { context: OrderCancellationContext; defaultFulfilmentId?: string }) {
  const [state, formAction, isPending] = useActionState(submitResolutionCaseAction, null);
  const [issueType, setIssueType] = useState(defaultFulfilmentId ? "CUSTOMER_CANCELLATION_REQUEST" : "ITEM_DAMAGED");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isCancellation = issueType === "CUSTOMER_CANCELLATION_REQUEST";
  const relevantFulfilments = isCancellation
    ? context.fulfilments.filter((f) => f.eligibility !== "BLOCKED")
    : context.fulfilments;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="orderId" value={context.orderId} />

      <div>
        <label className="text-sm font-medium text-espresso-950">What went wrong?</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ISSUE_TYPES.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3.5 py-2.5 text-sm ${
                issueType === option.value ? "border-forest-700 bg-champagne-200/20" : "border-ivory-400 bg-white hover:bg-ivory-50"
              }`}
            >
              <span className="flex items-center gap-2 font-medium text-espresso-950">
                <input
                  type="radio"
                  name="issueType"
                  value={option.value}
                  checked={issueType === option.value}
                  onChange={() => setIssueType(option.value)}
                  className="accent-forest-800"
                />
                {option.label}
              </span>
              {option.hint ? <span className="pl-6 text-xs text-espresso-900/50">{option.hint}</span> : null}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-espresso-950">Affected item(s)</label>
        <div className="mt-2 flex flex-col gap-3">
          {relevantFulfilments.map((f) => (
            <div key={f.fulfilmentId} className="rounded-lg border border-ivory-300 p-3.5">
              <p className="flex items-center justify-between text-xs text-espresso-900/50">
                <span>{f.vendorName}</span>
                {isCancellation ? <span className="font-medium text-champagne-700">{ELIGIBILITY_LABEL[f.eligibility]}</span> : null}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {f.items.map((item) => {
                  const key = item.orderItemId;
                  const checked = selected.has(key);
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex flex-1 items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-forest-800"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(key);
                            else next.delete(key);
                            setSelected(next);
                          }}
                        />
                        {checked ? <input type="hidden" name="orderItemId" value={item.orderItemId} /> : null}
                        <span className="text-espresso-900">
                          {item.description} <span className="text-espresso-900/35">({formatPrice(item.unitPrice, "GHS")} each, qty {item.quantity})</span>
                        </span>
                      </label>
                      {checked ? (
                        <input
                          type="number"
                          name="quantity"
                          min={1}
                          max={item.quantity}
                          defaultValue={item.quantity}
                          aria-label={`Quantity affected for ${item.description}`}
                          className="w-20 rounded-lg border border-ivory-400 px-2 py-1.5 text-sm"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {isCancellation && fulfilmentHasSelectedItem(selected, f.items) ? (
                <input type="hidden" name="fulfilmentId" value={f.fulfilmentId} />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="text-sm font-medium text-espresso-950">
          Tell us what happened
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          required
          minLength={5}
          placeholder="Describe the issue in a bit of detail…"
          className="mt-2 w-full rounded-lg border border-ivory-400 px-3.5 py-2.5 text-sm outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
        />
      </div>

      <div>
        <label htmlFor="evidence" className="text-sm font-medium text-espresso-950">
          Photos or documents (optional)
        </label>
        <input
          id="evidence"
          type="file"
          name="evidence"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="mt-2 block w-full text-sm text-espresso-900/65 file:mr-3 file:rounded-lg file:border-0 file:bg-ivory-100 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-espresso-800 hover:file:bg-ivory-300"
        />
      </div>

      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <Button type="submit" disabled={isPending || selected.size === 0}>
        {isPending ? "Submitting…" : "Submit report"}
      </Button>
    </form>
  );
}

function fulfilmentHasSelectedItem(selected: Set<string>, items: { orderItemId: string }[]): boolean {
  return items.some((item) => selected.has(item.orderItemId));
}
