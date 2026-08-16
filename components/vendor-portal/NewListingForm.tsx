"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { createListingAction } from "../../lib/actions/vendor-listings";

type Category = { id: string; name: string; children: { id: string; name: string }[] };

export function NewListingForm({ categories }: { categories: Category[] }) {
  const [state, formAction, isPending] = useActionState(createListingAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-sm font-medium text-stone-700">
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          defaultValue=""
          className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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
        <p className="text-xs text-stone-500">You can change this later — everything else is filled in next.</p>
      </div>

      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Creating…" : "Start listing"}
      </Button>
    </form>
  );
}
