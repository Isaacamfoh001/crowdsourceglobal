import { Input } from "../ui/Input";
import { GHANA_REGIONS } from "../../modules/orders/types";
import type { AddressView } from "../../modules/addresses/types";

/** Shared field markup for both the account "add/edit address" form and checkout's "add new address" panel — same field names the server actions/schemas already expect. */
export function AddressFormFields({ defaults, disabled }: { defaults?: AddressView; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Input label="Label (optional)" name="label" placeholder="Home, Office, etc." defaultValue={defaults?.label ?? ""} disabled={disabled} />
      <Input label="Recipient name" name="recipientName" autoComplete="name" required defaultValue={defaults?.recipientName} disabled={disabled} />
      <Input
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="024 123 4567"
        required
        defaultValue={defaults?.phone}
        disabled={disabled}
      />
      <Input
        label="Delivery address"
        name="addressLine1"
        autoComplete="address-line1"
        placeholder="Street, house number, landmark"
        required
        defaultValue={defaults?.addressLine1}
        disabled={disabled}
      />
      <Input
        label="Additional address details (optional)"
        name="addressLine2"
        autoComplete="address-line2"
        defaultValue={defaults?.addressLine2 ?? ""}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="City / Town" name="city" autoComplete="address-level2" required defaultValue={defaults?.city} disabled={disabled} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="region" className="text-sm font-medium text-espresso-800">
            Region
          </label>
          <select
            id="region"
            name="region"
            required
            disabled={disabled}
            defaultValue={defaults?.region ?? ""}
            className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
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
    </div>
  );
}
