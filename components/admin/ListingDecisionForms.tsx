"use client";

import { useActionState } from "react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import {
  approveListingAction,
  reassignListingCategoryAction,
  requestListingChangesAction,
  rejectListingAction,
} from "../../lib/actions/admin";

type Category = { id: string; name: string; children: { id: string; name: string }[] };

/**
 * M32.10 — the "map to an existing category" taxonomy decision: shown only
 * for a first-time submission (`categoryOther` set, not a staged edit) so
 * admin can move it off the "Other / Not listed" placeholder onto a real,
 * browsable category before approving. See vendorListingsService's
 * `reassignCategory` doc comment for why "create a brand-new category" is
 * deliberately not offered here.
 */
function CategoryReassignmentForm({ listingId, categoryOther, categories }: { listingId: string; categoryOther: string; categories: Category[] }) {
  const [state, formAction, isPending] = useActionState(reassignListingCategoryAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-champagne-300 bg-champagne-200/20 p-4">
      <input type="hidden" name="listingId" value={listingId} />
      <p className="text-sm text-espresso-800">
        This vendor suggested a category we don&apos;t have: <span className="font-medium">&ldquo;{categoryOther}&rdquo;</span>. Map it to
        an existing category before approving, or leave it under &ldquo;Other / Not listed&rdquo;.
      </p>
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state && state.ok ? <FormMessage tone="success">Category updated.</FormMessage> : null}
      <div className="flex flex-wrap items-end gap-3">
        <select
          name="categoryId"
          required
          defaultValue=""
          className="rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950"
        >
          <option value="" disabled>
            Select a category
          </option>
          {categories.map((category) => (
            <optgroup key={category.id} label={category.name}>
              <option value={category.id}>{category.name}</option>
              {category.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {category.name} — {child.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Assign category"}
        </Button>
      </div>
    </form>
  );
}

export function ListingDecisionForms({
  listingId,
  isEdit,
  categoryOther,
  categories,
}: {
  listingId: string;
  isEdit: boolean;
  categoryOther?: string | null;
  categories?: Category[];
}) {
  const [approveState, approveAction, approvePending] = useActionState(approveListingAction, null);
  const [changesState, changesAction, changesPending] = useActionState(requestListingChangesAction, null);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectListingAction, null);
  const [mode, setMode] = useState<"none" | "changes" | "reject">("none");

  return (
    <div className="flex flex-col gap-4">
      {categoryOther && categories ? (
        <CategoryReassignmentForm listingId={listingId} categoryOther={categoryOther} categories={categories} />
      ) : null}

      {approveState && !approveState.ok ? <FormMessage tone="error">{approveState.error}</FormMessage> : null}

      <form action={approveAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <Button type="submit" size="lg" disabled={approvePending} className="w-full sm:w-auto">
          {approvePending ? "Approving…" : isEdit ? "Approve changes" : "Approve listing"}
        </Button>
      </form>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setMode(mode === "changes" ? "none" : "changes")}
          className="text-sm font-medium text-espresso-900/65 underline decoration-ivory-400 hover:text-espresso-950"
        >
          Request changes
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "reject" ? "none" : "reject")}
          className="text-sm font-medium text-danger-600 underline decoration-danger-200 hover:text-danger-800"
        >
          {isEdit ? "Discard this edit" : "Reject"}
        </button>
      </div>

      {mode === "changes" ? (
        <form action={changesAction} className="flex flex-col gap-2 rounded-xl border border-ivory-300 p-4">
          <input type="hidden" name="listingId" value={listingId} />
          {changesState && !changesState.ok ? <FormMessage tone="error">{changesState.error}</FormMessage> : null}
          <label htmlFor="changesReason" className="text-sm font-medium text-espresso-800">
            What needs to change?
          </label>
          <textarea
            id="changesReason"
            name="reason"
            rows={3}
            required
            className="w-full rounded-lg border border-ivory-400 px-3.5 py-2.5 text-sm"
          />
          <Button type="submit" variant="outline" disabled={changesPending} className="w-fit">
            {changesPending ? "Sending…" : "Send back for changes"}
          </Button>
        </form>
      ) : null}

      {mode === "reject" ? (
        <form action={rejectAction} className="flex flex-col gap-2 rounded-xl border border-danger-200 bg-danger-50 p-4">
          <input type="hidden" name="listingId" value={listingId} />
          {rejectState && !rejectState.ok ? <FormMessage tone="error">{rejectState.error}</FormMessage> : null}
          <label htmlFor="rejectReason" className="text-sm font-medium text-espresso-800">
            {isEdit ? "Note (optional context, not shown to vendor for a discarded edit)" : "Reason for rejection"}
          </label>
          <textarea
            id="rejectReason"
            name="reason"
            rows={3}
            required
            className="w-full rounded-lg border border-ivory-400 px-3.5 py-2.5 text-sm"
          />
          <Button type="submit" variant="outline" disabled={rejectPending} className="w-fit border-danger-200 text-danger-700">
            {rejectPending ? "Sending…" : isEdit ? "Discard edit" : "Confirm rejection"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
