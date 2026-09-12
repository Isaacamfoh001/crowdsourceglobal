"use client";

import { useState } from "react";
import { AddressFormFields } from "../account/AddressFormFields";
import { DeliveryAddressFormFields } from "./DeliveryAddressFormFields";
import type { AddressView } from "../../modules/addresses/types";

/**
 * Shared by cart checkout and quote checkout (both ultimately submit the
 * same field names `parseDeliveryFormData`/deliverySchema already expects
 * — see lib/delivery-schema.ts). Selecting a saved address submits hidden
 * inputs mirroring its exact current values; nothing about the Order-
 * creation path changes. The Order snapshots whatever is in these fields
 * at submit time, exactly as before this feature existed.
 *
 * `countryAware` (M32.9, opt-in — QuoteCheckoutForm only, for now) swaps
 * the plain Ghana-only "new address" fields for DeliveryAddressFormFields'
 * country-first fields, and hides "Save this address for next time" once a
 * non-Ghana country is chosen — the saved-address book is still Ghana-only
 * (see that component's doc comment). Saved addresses themselves are
 * unaffected either way: they're always Ghana (the only country
 * `CustomerAddress` can represent), so a hidden `country=Ghana` is
 * submitted alongside them regardless of `countryAware`.
 */
export function DeliveryAddressFields({
  addresses,
  disabled,
  countryAware = false,
}: {
  addresses: AddressView[];
  disabled?: boolean;
  countryAware?: boolean;
}) {
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const [mode, setMode] = useState<"saved" | "new">(defaultAddress ? "saved" : "new");
  const [selectedId, setSelectedId] = useState(defaultAddress?.id ?? "");
  const [newAddressCountry, setNewAddressCountry] = useState("Ghana");
  const selected = addresses.find((a) => a.id === selectedId) ?? null;

  if (mode === "saved" && addresses.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-espresso-800">Deliver to</p>
        <div className="flex flex-col gap-2">
          {addresses.map((address) => (
            <label
              key={address.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 ${
                selectedId === address.id ? "border-espresso-800 bg-champagne-200/20" : "border-ivory-300"
              }`}
            >
              <input
                type="radio"
                name="_addressPicker"
                className="mt-1"
                checked={selectedId === address.id}
                onChange={() => setSelectedId(address.id)}
                disabled={disabled}
              />
              <span className="text-sm">
                <span className="flex items-center gap-2 font-medium text-espresso-950">
                  {address.label || "Address"}
                  {address.isDefault ? <span className="text-xs font-normal text-espresso-900/50">(default)</span> : null}
                </span>
                <span className="block text-espresso-900/65">{address.recipientName}</span>
                <span className="block text-espresso-900/65">
                  {address.addressLine1}
                  {address.addressLine2 ? `, ${address.addressLine2}` : ""}, {address.city}, {address.region}
                </span>
                <span className="block text-espresso-900/50">{address.phone}</span>
              </span>
            </label>
          ))}
        </div>
        <button type="button" onClick={() => setMode("new")} className="w-fit text-sm font-medium text-espresso-800 hover:underline">
          + Add new address
        </button>

        {selected ? (
          <>
            <input type="hidden" name="recipientName" value={selected.recipientName} />
            <input type="hidden" name="phone" value={selected.phone} />
            <input type="hidden" name="addressLine1" value={selected.addressLine1} />
            <input type="hidden" name="addressLine2" value={selected.addressLine2 ?? ""} />
            <input type="hidden" name="city" value={selected.city} />
            <input type="hidden" name="country" value="Ghana" />
            <input type="hidden" name="region" value={selected.region} />
          </>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="text-sm font-medium text-espresso-800">
            Delivery notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            disabled={disabled}
            placeholder="Gate code, preferred delivery time, etc."
            className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {addresses.length > 0 ? (
        <button type="button" onClick={() => setMode("saved")} className="w-fit text-sm font-medium text-espresso-800 hover:underline">
          ← Use a saved address
        </button>
      ) : null}
      {countryAware ? (
        <DeliveryAddressFormFields disabled={disabled} onCountryChange={setNewAddressCountry} />
      ) : (
        <AddressFormFields disabled={disabled} />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-espresso-800">
          Delivery notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          disabled={disabled}
          placeholder="Gate code, preferred delivery time, etc."
          className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
        />
      </div>
      {!countryAware || newAddressCountry === "Ghana" ? (
        <label className="flex items-center gap-2 text-sm text-espresso-900/65">
          <input type="checkbox" name="saveAddress" value="1" disabled={disabled} />
          Save this address for next time
        </label>
      ) : null}
    </div>
  );
}
