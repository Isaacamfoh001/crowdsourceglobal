"use client";

import { useState } from "react";
import { Input } from "../ui/Input";
import { CountrySelect } from "../ui/CountrySelect";
import { GHANA_REGIONS } from "../../modules/orders/types";

/**
 * M32.9 — country-aware "new address" fields for one-off order delivery
 * (cart checkout / quote acceptance), distinct from
 * components/account/AddressFormFields.tsx: that form edits a persisted
 * `CustomerAddress`, a real, still Ghana-only schema table (no country
 * column) — it must never imply international saved addresses work today.
 * This component instead feeds `Order.deliveryInfo`, a flexible JSON field,
 * so a non-Ghana country needs no migration. Selecting a country other than
 * Ghana unmounts the Region `<select>` entirely — an unmounted form control
 * submits nothing, so switching away from Ghana can never leak a stale
 * Ghana region, and switching back always requires a fresh selection.
 */
export function DeliveryAddressFormFields({
  disabled,
  onCountryChange,
}: {
  disabled?: boolean;
  onCountryChange?: (country: string) => void;
}) {
  const [country, setCountry] = useState("Ghana");
  const isGhana = country === "Ghana";

  function handleCountryChange(next: string) {
    setCountry(next);
    onCountryChange?.(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <Input label="Label (optional)" name="label" placeholder="Home, Office, etc." disabled={disabled} />
      <Input label="Recipient name" name="recipientName" autoComplete="name" required disabled={disabled} />
      <Input
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="024 123 4567"
        required
        disabled={disabled}
      />
      <CountrySelect label="Country" name="country" defaultValue="Ghana" required disabled={disabled} onChange={handleCountryChange} />
      <Input
        label="Delivery address"
        name="addressLine1"
        autoComplete="address-line1"
        placeholder="Street, house number, landmark"
        required
        disabled={disabled}
      />
      <Input
        label="Additional address details (optional)"
        name="addressLine2"
        autoComplete="address-line2"
        disabled={disabled}
      />
      {isGhana ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="City / Town" name="city" autoComplete="address-level2" required disabled={disabled} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="region" className="text-sm font-medium text-espresso-800">
              Region
            </label>
            <select
              id="region"
              name="region"
              required
              disabled={disabled}
              defaultValue=""
              className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
            >
              <option value="" disabled>
                Select region
              </option>
              {GHANA_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <Input label="City / Town" name="city" autoComplete="address-level2" required disabled={disabled} />
      )}
    </div>
  );
}
