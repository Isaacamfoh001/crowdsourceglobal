"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import { updateStoreProfileAction } from "../../lib/actions/vendor-store";
import type { VendorStoreProfile } from "../../modules/vendors/types";

type Category = { id: string; name: string; slug: string };

export function StoreProfileForm({ profile, categories }: { profile: VendorStoreProfile; categories: Category[] }) {
  const [state, formAction, isPending] = useActionState(updateStoreProfileAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state && state.ok ? <FormMessage tone="success">Store profile updated.</FormMessage> : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-medium text-espresso-950">Public storefront</h2>
        <Input label="Store name" name="companyName" defaultValue={profile.companyName} required disabled={isPending} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-espresso-800">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={profile.description ?? ""}
            disabled={isPending}
            className="w-full rounded-lg border border-ivory-400 bg-white px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
          />
        </div>
        <Input
          label="Logo URL (optional)"
          name="logoUrl"
          defaultValue={profile.logoUrl ?? ""}
          placeholder="https://…"
          hint="No image upload yet — paste a hosted image link."
          disabled={isPending}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Country" name="country" defaultValue={profile.country ?? ""} disabled={isPending} />
          <Input label="Region" name="region" defaultValue={profile.region ?? ""} disabled={isPending} />
          <Input label="City" name="city" defaultValue={profile.city ?? ""} disabled={isPending} />
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-espresso-800">Specialties</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label key={category.id} className="flex items-center gap-2 text-sm text-espresso-800">
                <input
                  type="checkbox"
                  name="categorySlugs"
                  value={category.slug}
                  defaultChecked={profile.categorySlugs.includes(category.slug)}
                  className="size-4 rounded accent-forest-800"
                />
                {category.name}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="flex flex-col gap-4 border-t border-ivory-100 pt-6">
        <div>
          <h2 className="font-display text-lg font-medium text-espresso-950">Operational contact</h2>
          <p className="mt-1 text-sm text-espresso-900/50">
            Private — used only for CrownSourceGlobal to reach you. Never shown to customers.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Contact email" name="contactEmail" type="email" defaultValue={profile.contactEmail ?? ""} disabled={isPending} />
          <Input label="Contact phone" name="contactPhone" type="tel" defaultValue={profile.contactPhone ?? ""} disabled={isPending} />
        </div>
        <Input
          label="Default lead time (days, optional)"
          name="leadTimeDaysDefault"
          type="number"
          min={0}
          defaultValue={profile.leadTimeDaysDefault ?? ""}
          disabled={isPending}
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-ivory-100 pt-6">
        <div>
          <h2 className="font-display text-lg font-medium text-espresso-950">Pickup / collection details</h2>
          <p className="mt-1 text-sm text-espresso-900/50">
            Private — how CrownSourceGlobal arranges collection of your orders. Never shown to customers.
          </p>
        </div>
        <Input
          label="Pickup address"
          name="pickupAddressLine1"
          defaultValue={profile.pickupAddressLine1 ?? ""}
          hint="The precise address a courier should collect from — may differ from your general store location."
          disabled={isPending}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Pickup contact name"
            name="pickupContactName"
            defaultValue={profile.pickupContactName ?? ""}
            disabled={isPending}
          />
          <Input
            label="Pickup contact phone"
            name="pickupContactPhone"
            type="tel"
            defaultValue={profile.pickupContactPhone ?? profile.contactPhone ?? ""}
            disabled={isPending}
          />
        </div>
        <Input
          label="Collection hours (optional)"
          name="pickupHours"
          defaultValue={profile.pickupHours ?? ""}
          placeholder="e.g. Mon–Sat, 9am–5pm"
          disabled={isPending}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pickupNotes" className="text-sm font-medium text-espresso-800">
            Collection notes (optional)
          </label>
          <textarea
            id="pickupNotes"
            name="pickupNotes"
            rows={2}
            defaultValue={profile.pickupNotes ?? ""}
            placeholder="Gate code, landmark, preferred entrance, etc."
            disabled={isPending}
            className="w-full rounded-lg border border-ivory-400 bg-white px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
          />
        </div>
      </section>

      <Button type="submit" size="lg" className="w-fit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
