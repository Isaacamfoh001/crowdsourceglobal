"use client";

import { useActionState, useState } from "react";
import {
  assignStaffAction,
  moveToUnderReviewAction,
  moveToSourcingAction,
  requestClarificationAction,
  addSourcingOptionAction,
  removeSourcingOptionAction,
  setAllocationsAction,
  prepareQuoteAction,
  markUnableToSourceAction,
} from "../../lib/actions/sourcing";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { MoneyInput } from "../ui/MoneyInput";
import { CountrySelect } from "../ui/CountrySelect";
import { FormMessage } from "../ui/FormMessage";
import { formatPrice } from "../../lib/format";
import type { Result } from "../../lib/result";
import type {
  AdminSourcingOptionView,
  SourcingOptionSourceType,
  StaffOption,
  VendorListingOption,
  VendorOption,
} from "../../modules/sourcing/types";

function ErrorMessage({ state }: { state: Result<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <div className="mt-2">
      <FormMessage tone="error">{state.error}</FormMessage>
    </div>
  );
}

export function AssignStaffForm({ id, staff, assignedStaffId }: { id: string; staff: StaffOption[]; assignedStaffId: string | null }) {
  const [state, formAction, isPending] = useActionState(assignStaffAction, null);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="staffId"
        defaultValue={assignedStaffId ?? ""}
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
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
      <ErrorMessage state={state} />
    </form>
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

export function AddSourcingOptionForm({
  id,
  vendors,
  listings,
}: {
  id: string;
  vendors: VendorOption[];
  listings: VendorListingOption[];
}) {
  const [state, formAction, isPending] = useActionState(addSourcingOptionAction, null);
  const [sourceType, setSourceType] = useState<SourcingOptionSourceType>("VENDOR_LISTING");

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-ivory-300 bg-ivory-50 p-4">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sourceType" className="text-sm font-medium text-espresso-800">
          Source type
        </label>
        <select
          id="sourceType"
          name="sourceType"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as SourcingOptionSourceType)}
          disabled={isPending}
          className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
        >
          <option value="VENDOR_LISTING">Existing vendor listing</option>
          <option value="VENDOR">Marketplace vendor (no matching listing)</option>
          <option value="EXTERNAL_SUPPLIER">External / off-platform supplier</option>
        </select>
      </div>

      {sourceType === "VENDOR_LISTING" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vendorListingId" className="text-sm font-medium text-espresso-800">
            Listing
          </label>
          <select
            id="vendorListingId"
            name="vendorListingId"
            required
            disabled={isPending}
            onChange={(e) => {
              const listing = listings.find((l) => l.id === e.target.value);
              const vendorField = document.getElementById("vendorId_hidden") as HTMLInputElement | null;
              if (vendorField && listing) vendorField.value = listing.vendorId;
            }}
            defaultValue=""
            className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
          >
            <option value="" disabled>
              Select a listing
            </option>
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.vendorName} — {listing.title}
              </option>
            ))}
          </select>
          <input type="hidden" id="vendorId_hidden" name="vendorId" />
        </div>
      ) : null}

      {sourceType === "VENDOR" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vendorId" className="text-sm font-medium text-espresso-800">
            Vendor
          </label>
          <select
            id="vendorId"
            name="vendorId"
            required
            disabled={isPending}
            defaultValue=""
            className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
          >
            <option value="" disabled>
              Select a vendor
            </option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.companyName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {sourceType === "EXTERNAL_SUPPLIER" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Supplier name" name="externalSupplierName" required disabled={isPending} />
          <Input label="Contact (private)" name="externalSupplierContact" disabled={isPending} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Input label="Available qty" name="quantityAvailable" type="number" min={1} disabled={isPending} />
        <Input label="Proposed qty" name="proposedQuantity" type="number" min={1} required disabled={isPending} />
        <MoneyInput label="Unit supply cost" name="unitSupplyCost" />
        <Input label="Lead time (days)" name="leadTimeDays" type="number" min={0} disabled={isPending} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CountrySelect label="Origin country" name="originCountry" disabled={isPending} />
        <Input label="Internal notes (staff-only)" name="notes" disabled={isPending} />
      </div>

      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Adding…" : "Add option"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function RemoveSourcingOptionButton({ id, optionId }: { id: string; optionId: string }) {
  const [, formAction, isPending] = useActionState(removeSourcingOptionAction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="optionId" value={optionId} />
      <button type="submit" disabled={isPending} className="text-xs font-medium text-espresso-900/35 hover:text-danger-600">
        Remove
      </button>
    </form>
  );
}

export function AllocationForm({ id, options, quantity }: { id: string; options: AdminSourcingOptionView[]; quantity: number }) {
  const [state, formAction, isPending] = useActionState(setAllocationsAction, null);
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(options.map((o) => [o.id, o.allocatedQuantity])),
  );

  const total = Object.values(values).reduce((sum, v) => sum + (v || 0), 0);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {options.map((option) => (
        <div key={option.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-espresso-800">
            {option.vendorName ?? option.vendorListingTitle ?? option.externalSupplierName ?? "Option"}
            <span className="ml-1.5 text-xs text-espresso-900/35">
              ({formatPrice(option.unitSupplyCost, option.currency)}/unit)
            </span>
          </span>
          <input
            type="number"
            name={`allocation_${option.id}`}
            min={0}
            value={values[option.id] ?? 0}
            onChange={(e) => setValues((prev) => ({ ...prev, [option.id]: Number(e.target.value) }))}
            disabled={isPending}
            className="w-24 rounded-lg border border-ivory-400 bg-ivory-50 px-3 py-1.5 text-right text-sm text-espresso-950 outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
          />
        </div>
      ))}
      <div className={`text-sm font-medium ${total === quantity ? "text-espresso-800" : "text-champagne-700"}`}>
        Allocated {total} of {quantity} requested
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? "Saving…" : "Save allocations"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function PrepareQuoteForm({
  id,
  allocationCost,
  currency,
}: {
  id: string;
  allocationCost: number;
  currency: string;
}) {
  const [state, formAction, isPending] = useActionState(prepareQuoteAction, null);
  const [otherCosts, setOtherCosts] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);

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
