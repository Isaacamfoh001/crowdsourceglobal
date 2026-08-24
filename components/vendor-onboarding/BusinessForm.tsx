"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import { saveBusinessAction } from "../../lib/actions/vendor-application";

type Initial = {
  displayName: string | null;
  legalName: string | null;
  storeDescription: string | null;
  registrationNumber: string | null;
  taxIdentifier: string | null;
  yearEstablished: number | null;
  websiteUrl: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  addressLine1: string | null;
};

export function BusinessForm({ initial, showRegistrationFields }: { initial: Initial; showRegistrationFields: boolean }) {
  const [state, formAction, isPending] = useActionState(saveBusinessAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <Input
        label="Store / business name"
        name="displayName"
        defaultValue={initial.displayName ?? ""}
        hint="This is what customers will see."
        required
        disabled={isPending}
      />
      {showRegistrationFields ? (
        <Input
          label="Legal name (optional)"
          name="legalName"
          defaultValue={initial.legalName ?? ""}
          hint="If different from your store name."
          disabled={isPending}
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="storeDescription" className="text-sm font-medium text-espresso-800">
          Store description
        </label>
        <textarea
          id="storeDescription"
          name="storeDescription"
          rows={3}
          defaultValue={initial.storeDescription ?? ""}
          placeholder="What do you sell, and what makes your store worth buying from?"
          required
          disabled={isPending}
          className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
        />
      </div>

      {showRegistrationFields ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Business registration number"
            name="registrationNumber"
            defaultValue={initial.registrationNumber ?? ""}
            required
            disabled={isPending}
          />
          <Input
            label="Tax identifier (optional)"
            name="taxIdentifier"
            defaultValue={initial.taxIdentifier ?? ""}
            disabled={isPending}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Year established (optional)"
          name="yearEstablished"
          type="number"
          defaultValue={initial.yearEstablished ?? ""}
          disabled={isPending}
        />
        <Input
          label="Website (optional)"
          name="websiteUrl"
          type="text"
          defaultValue={initial.websiteUrl ?? ""}
          placeholder="https://…"
          disabled={isPending}
        />
      </div>

      <div className="mt-2 border-t border-ivory-100 pt-4">
        <p className="text-sm font-medium text-espresso-800">Location</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Country" name="country" defaultValue={initial.country ?? "Ghana"} required disabled={isPending} />
          <Input label="Region" name="region" defaultValue={initial.region ?? ""} required disabled={isPending} />
          <Input label="City / Town" name="city" defaultValue={initial.city ?? ""} required disabled={isPending} />
          <Input
            label="Address"
            name="addressLine1"
            defaultValue={initial.addressLine1 ?? ""}
            required
            disabled={isPending}
          />
        </div>
      </div>

      <Button type="submit" size="lg" fullWidth disabled={isPending} className="mt-2">
        {isPending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
