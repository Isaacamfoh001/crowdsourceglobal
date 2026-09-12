"use client";

import { useActionState, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import { createListingAction } from "../../lib/actions/vendor-listings";

type Category = { id: string; name: string; children: { id: string; name: string }[] };
const OTHER_VALUE = "__other__";

export function NewListingForm({ categories }: { categories: Category[] }) {
  const [state, formAction, isPending] = useActionState(createListingAction, null);
  const [showOtherInput, setShowOtherInput] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-sm font-medium text-espresso-800">
          Category
        </label>
        <select
          id="categoryId"
          name={showOtherInput ? undefined : "categoryId"}
          required
          defaultValue=""
          onChange={(event) => setShowOtherInput(event.target.value === OTHER_VALUE)}
          className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-espresso-800 focus:ring-2 focus:ring-champagne-200"
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
          <option value={OTHER_VALUE}>Other / Not listed</option>
        </select>
        {showOtherInput ? (
          <Input
            label="What category is this?"
            name="categoryOther"
            placeholder="e.g. Hair tools, Party supplies"
            required
          />
        ) : (
          <p className="text-xs text-espresso-900/50">You can change this later — everything else is filled in next.</p>
        )}
      </div>

      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Creating…" : "Start listing"}
      </Button>
    </form>
  );
}
