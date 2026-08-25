"use client";

import { useActionState } from "react";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import { getCategoryIcon } from "../catalogue/categoryIcons";
import { StepActions } from "./StepActions";
import { saveOperationsAction } from "../../lib/actions/vendor-application";

type Category = { id: string; name: string; slug: string };

const SELLING_MODES = [
  { value: "retail", label: "Retail (individual units)" },
  { value: "wholesale", label: "Wholesale (bulk only)" },
  { value: "both", label: "Both retail and wholesale" },
];

export function OperationsForm({
  categories,
  initial,
}: {
  categories: Category[];
  initial: {
    categorySlugs: string[];
    sellingMode: string | null;
    bulkCapable: boolean;
    leadTimeDaysDefault: number | null;
    serviceAreas: string | null;
  };
}) {
  const [state, formAction, isPending] = useActionState(saveOperationsAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <fieldset>
        <legend className="text-sm font-medium text-espresso-800">What do you sell?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.slug);
            return (
              <label
                key={category.id}
                className="flex min-h-[4.5rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-ivory-300 p-3 text-center transition-colors has-[:checked]:border-espresso-800 has-[:checked]:bg-champagne-200/20"
              >
                <input
                  type="checkbox"
                  name="categorySlugs"
                  value={category.slug}
                  defaultChecked={initial.categorySlugs.includes(category.slug)}
                  className="sr-only"
                />
                <Icon className="size-5 text-espresso-800" strokeWidth={1.5} />
                <span className="text-[13px] leading-snug font-medium text-espresso-900">
                  {category.name}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-espresso-800">How do you sell?</legend>
        <div className="mt-2 flex flex-col gap-2">
          {SELLING_MODES.map((mode) => (
            <label key={mode.value} className="flex items-center gap-2 text-sm text-espresso-800">
              <input
                type="radio"
                name="sellingMode"
                value={mode.value}
                defaultChecked={initial.sellingMode === mode.value}
                required
                className="size-4 accent-espresso-800"
              />
              {mode.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-espresso-800">
        <input
          type="checkbox"
          name="bulkCapable"
          defaultChecked={initial.bulkCapable}
          className="size-4 rounded accent-espresso-800"
        />
        I can fulfil large bulk orders
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Typical lead time in days (optional)"
          name="leadTimeDaysDefault"
          type="number"
          min={0}
          defaultValue={initial.leadTimeDaysDefault ?? ""}
          hint="How long orders usually take to prepare."
          disabled={isPending}
        />
        <Input
          label="Delivery / service areas (optional)"
          name="serviceAreas"
          defaultValue={initial.serviceAreas ?? ""}
          placeholder="e.g. Greater Accra, nationwide"
          disabled={isPending}
        />
      </div>

      <StepActions
        previousHref="/vendor/onboarding/business"
        submitLabel="Continue to review"
        pendingLabel="Saving…"
        isPending={isPending}
      />
    </form>
  );
}
