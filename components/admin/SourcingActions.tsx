"use client";

import { useActionState, useState, useTransition } from "react";
import {
  assignStaffAction,
  moveToUnderReviewAction,
  moveToSourcingAction,
  requestClarificationAction,
  sendToFactoriesAction,
  convertSolicitationToOptionAction,
  prepareQuoteAction,
  markUnableToSourceAction,
} from "../../lib/actions/sourcing";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { formatPrice } from "../../lib/format";
import type { Result } from "../../lib/result";
import type { AdminSourcingSolicitationView, QuotePricingSuggestion, StaffOption, VendorOption } from "../../modules/sourcing/types";

function ErrorMessage({ state }: { state: Result<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <div className="mt-2">
      <FormMessage tone="error">{state.error}</FormMessage>
    </div>
  );
}

export function AssignStaffForm({ id, staff, assignedStaffId }: { id: string; staff: StaffOption[]; assignedStaffId: string | null }) {
  // M25.2 Part 2 finding: a `<form action={fn}>` (useActionState's normal
  // wiring) makes React call the native `HTMLFormElement.reset()` on every
  // successful submit (react-dom-client's `fiber.stateNode.reset()`) — a
  // raw, un-React DOM operation that resets EVERY control to its plain HTML
  // default (a `<select>` falls back to its first `<option>`, i.e.
  // "Unassigned"), regardless of whether React considers it "controlled".
  // That's the right default for a fresh "add a comment"-style form; for a
  // persistent field being *edited*, it made the admin's assignment look
  // reverted right after a successful save even though the write was
  // already durably persisted (confirmed against the real dev DB). Fix:
  // invoke the same server action directly from a click handler via
  // useTransition instead of via `<form action>` — this never enters
  // React's form-reset codepath at all, since that path is only reachable
  // through the native form-submission plumbing.
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<Result<null> | null>(null);
  const [selected, setSelected] = useState(assignedStaffId ?? "");
  // Adjusting state during render (React's documented pattern for "reset
  // state when a prop changes") rather than in a useEffect — an effect
  // would run one render late and trip react-hooks/set-state-in-effect.
  const [prevAssignedStaffId, setPrevAssignedStaffId] = useState(assignedStaffId);
  if (assignedStaffId !== prevAssignedStaffId) {
    setPrevAssignedStaffId(assignedStaffId);
    setSelected(assignedStaffId ?? "");
  }

  function handleSave() {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("staffId", selected);
    startTransition(async () => {
      setState(await assignStaffAction(null, formData));
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={isPending}
        className="rounded-lg border border-ivory-400 bg-ivory-50 px-3 py-2 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
      >
        <option value="">Unassigned</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleSave}>
        {isPending ? "Saving…" : "Save"}
      </Button>
      <ErrorMessage state={state} />
    </div>
  );
}

export function MoveToUnderReviewButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(moveToUnderReviewAction, null);
  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Moving…" : "Start review"}
        </Button>
      </form>
      <ErrorMessage state={state} />
    </div>
  );
}

export function MoveToSourcingButton({ id, label = "Move to sourcing" }: { id: string; label?: string }) {
  const [state, formAction, isPending] = useActionState(moveToSourcingAction, null);
  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Moving…" : label}
        </Button>
      </form>
      <ErrorMessage state={state} />
    </div>
  );
}

export function RequestClarificationForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(requestClarificationAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="message"
        rows={2}
        required
        placeholder="What do you need from the customer?"
        disabled={isPending}
        className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
      />
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Sending…" : "Request clarification"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function AskFactoriesForm({
  id,
  vendors,
  alreadyAskedVendorIds,
}: {
  id: string;
  vendors: VendorOption[];
  alreadyAskedVendorIds: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<Result<null> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const eligible = vendors.filter((v) => !alreadyAskedVendorIds.includes(v.id));

  function toggle(vendorId: string) {
    setSelected((prev) => (prev.includes(vendorId) ? prev.filter((v) => v !== vendorId) : [...prev, vendorId]));
  }

  function send(vendorIds: string[]) {
    if (vendorIds.length === 0) return;
    const formData = new FormData();
    formData.set("id", id);
    vendorIds.forEach((vendorId) => formData.append("vendorId", vendorId));
    startTransition(async () => {
      const result = await sendToFactoriesAction(null, formData);
      setState(result);
      if (result.ok) setSelected([]);
    });
  }

  if (eligible.length === 0) {
    return <p className="text-sm text-espresso-900/50">All approved factories have already been asked.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {eligible.map((vendor) => (
          <label
            key={vendor.id}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-ivory-400 bg-ivory-50 px-3 py-1.5 text-sm text-espresso-900/80 has-[:checked]:border-espresso-800 has-[:checked]:bg-champagne-200/20"
          >
            <input
              type="checkbox"
              checked={selected.includes(vendor.id)}
              onChange={() => toggle(vendor.id)}
              disabled={isPending}
              className="accent-espresso-800"
            />
            {vendor.companyName}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={isPending || selected.length === 0} onClick={() => send(selected)}>
          {isPending ? "Sending…" : `Ask selected (${selected.length})`}
        </Button>
        <Button type="button" size="sm" disabled={isPending} onClick={() => send(eligible.map((v) => v.id))}>
          {isPending ? "Sending…" : "Ask all eligible factories"}
        </Button>
      </div>
      <ErrorMessage state={state} />
    </div>
  );
}

function UseSolicitationButton({ id, solicitationId, isWinner }: { id: string; solicitationId: string; isWinner: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<Result<null> | null>(null);

  function handleClick() {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("solicitationId", solicitationId);
    startTransition(async () => {
      setState(await convertSolicitationToOptionAction(null, formData));
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant={isWinner ? "outline" : "primary"} disabled={isPending || isWinner} onClick={handleClick}>
        {isWinner ? "Selected as supplier" : isPending ? "Selecting…" : "Select this supplier"}
      </Button>
      <ErrorMessage state={state} />
    </div>
  );
}

/**
 * M32.9 — the response-comparison list IS the sourcing decision surface now:
 * one card per factory, "Select this supplier" awards it the request in one
 * click (auto-creates its internal option/allocation — never a separate
 * "internal sourcing option" or "save allocation" step). Never renders like
 * a database editor: no internal ids, no raw JSON, no "allocation"/"sourcing
 * option" terminology.
 */
export function FactoryResponsesSection({
  id,
  solicitations,
  winningOptionIds,
}: {
  id: string;
  solicitations: AdminSourcingSolicitationView[];
  /** Option ids currently carrying the request's live allocation — at most one, per the single-winning-factory rule. */
  winningOptionIds: Set<string>;
}) {
  if (solicitations.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-espresso-950">Factory Responses ({solicitations.length})</h3>
      {solicitations.map((solicitation) => {
        const isWinner = !!solicitation.convertedToOptionId && winningOptionIds.has(solicitation.convertedToOptionId);
        const supplierTotal =
          solicitation.proposedQuantity != null && solicitation.unitPrice != null
            ? solicitation.proposedQuantity * solicitation.unitPrice
            : null;
        return (
          <div
            key={solicitation.id}
            className={`flex items-start justify-between gap-3 rounded-xl border p-4 ${isWinner ? "border-espresso-800 bg-champagne-200/10" : "border-ivory-300"}`}
          >
            <div>
              <p className="font-medium text-espresso-950">
                {solicitation.vendorName}
                {isWinner ? <span className="ml-2 text-xs font-medium text-espresso-800">Selected supplier</span> : null}
              </p>
              {solicitation.status === "SENT" ? (
                <p className="mt-0.5 text-sm text-espresso-900/50">Awaiting response…</p>
              ) : solicitation.status === "CANNOT_FULFIL" ? (
                <p className="mt-0.5 text-sm font-medium text-danger-600">Cannot fulfil</p>
              ) : (
                <div className="mt-1 text-sm text-espresso-900/75">
                  <p className="font-medium text-espresso-950">
                    {solicitation.proposedQuantity?.toLocaleString()} units · {formatPrice(solicitation.unitPrice ?? 0, solicitation.currency)}/unit
                    {supplierTotal != null ? ` · Total ${formatPrice(supplierTotal, solicitation.currency)}` : ""}
                  </p>
                  <p className="mt-0.5 text-espresso-900/50">
                    {solicitation.leadTimeDays ? `${solicitation.leadTimeDays} days lead time` : "Lead time not specified"}
                    {solicitation.respondedAt
                      ? ` · Submitted ${solicitation.respondedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                      : ""}
                  </p>
                  {solicitation.notes ? <p className="mt-1 italic text-espresso-900/50">&ldquo;{solicitation.notes}&rdquo;</p> : null}
                </div>
              )}
            </div>
            {solicitation.status === "RESPONDED" ? <UseSolicitationButton id={id} solicitationId={solicitation.id} isWinner={isWinner} /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function PrepareQuoteForm({
  id,
  allocationCost,
  currency,
  pricingSuggestion,
}: {
  id: string;
  allocationCost: number;
  currency: string;
  /** Server-computed (Decimal) markup suggestion from the selected factory response — a prefill default only; prepareAndIssueQuote independently validates whatever admin actually submits. Null for a multi-vendor allocation, where there's no single factory price to suggest from. */
  pricingSuggestion?: QuotePricingSuggestion | null;
}) {
  const [state, formAction, isPending] = useActionState(prepareQuoteAction, null);
  const [otherCosts, setOtherCosts] = useState(0);
  const [unitPrice, setUnitPrice] = useState(pricingSuggestion?.customerUnitPrice ?? 0);
  // Adjusting state during render (React's documented pattern) rather than
  // a useEffect: allocating supply and preparing the quote both happen on
  // this same page, so a fresh pricingSuggestion can arrive well after this
  // form's first mount (e.g. once allocations are saved) — a plain
  // useState initializer only runs once and would leave the field
  // permanently blank until a hard reload (M25.2 finding).
  const suggestionKey = pricingSuggestion?.customerUnitPrice ?? null;
  const [prevSuggestionKey, setPrevSuggestionKey] = useState(suggestionKey);
  if (suggestionKey !== prevSuggestionKey) {
    setPrevSuggestionKey(suggestionKey);
    setUnitPrice(suggestionKey ?? 0);
  }

  const internalTotal = allocationCost + otherCosts;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-espresso-800">
          Customer-facing commercial description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          required
          placeholder="e.g. 500 Custom Embroidered Polo Shirts, navy blue, 220gsm cotton, left-chest logo"
          disabled={isPending}
          className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-espresso-800">Other internal costs (optional)</label>
          <input
            type="number"
            name="otherInternalCosts"
            min={0}
            step="0.01"
            value={otherCosts || ""}
            onChange={(e) => setOtherCosts(Number(e.target.value) || 0)}
            disabled={isPending}
            placeholder="0.00"
            className="mt-1.5 w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-espresso-800">Customer unit price</label>
          <input
            type="number"
            name="unitPrice"
            min={0}
            step="0.01"
            required
            value={unitPrice || ""}
            onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
            disabled={isPending}
            placeholder="0.00"
            className="mt-1.5 w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
          />
        </div>
      </div>

      {pricingSuggestion ? (
        <div className="rounded-xl border border-ivory-300 bg-ivory-50 p-4 text-sm">
          <p className="mb-2 text-xs font-medium tracking-wide text-espresso-900/40 uppercase">Suggested from factory response</p>
          <div className="flex justify-between text-espresso-900/65">
            <span>Factory proposed quantity</span>
            <span>{pricingSuggestion.factoryQuantity.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-espresso-900/65">
            <span>Factory unit price</span>
            <span>{formatPrice(pricingSuggestion.factoryUnitPrice, pricingSuggestion.currency)}</span>
          </div>
          <div className="flex justify-between text-espresso-900/65">
            <span>Factory subtotal</span>
            <span>{formatPrice(pricingSuggestion.factorySubtotal, pricingSuggestion.currency)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-ivory-300 pt-1 text-espresso-900/65">
            <span>CrownSource markup</span>
            <span>{pricingSuggestion.markupPercent}%</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-ivory-300 pt-1 font-medium text-espresso-950">
            <span>Suggested customer unit price</span>
            <span>{formatPrice(pricingSuggestion.customerUnitPrice, pricingSuggestion.currency)}</span>
          </div>
          <div className="flex justify-between font-medium text-espresso-950">
            <span>Suggested customer subtotal</span>
            <span>{formatPrice(pricingSuggestion.customerSubtotal, pricingSuggestion.currency)}</span>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-ivory-300 bg-ivory-50 p-4 text-sm">
        <div className="flex justify-between text-espresso-900/65">
          <span>Supplier allocation cost</span>
          <span>{formatPrice(allocationCost, currency)}</span>
        </div>
        <div className="flex justify-between text-espresso-900/65">
          <span>Other internal costs</span>
          <span>{formatPrice(otherCosts, currency)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-ivory-300 pt-1 font-medium text-espresso-950">
          <span>Internal total</span>
          <span>{formatPrice(internalTotal, currency)}</span>
        </div>
      </div>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Issuing…" : "Prepare & issue quotation"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function MarkUnableToSourceForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(markUnableToSourceAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="reason"
        rows={2}
        required
        placeholder="Customer-safe explanation — this is shown to the customer."
        disabled={isPending}
        className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Saving…" : "Mark unable to source"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}
