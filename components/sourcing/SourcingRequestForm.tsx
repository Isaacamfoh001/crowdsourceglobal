"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2, UploadCloud } from "lucide-react";
import { submitSourcingRequestAction } from "../../lib/actions/sourcing";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import type { PublicCategoryWithChildren } from "../../modules/catalogue/types";

const ACCEPTED_TYPES = ".png,.jpg,.jpeg,.webp,.pdf,.csv,.xlsx";

export function SourcingRequestForm({ categories }: { categories: PublicCategoryWithChildren[] }) {
  const [state, formAction, isPending] = useActionState(submitSourcingRequestAction, null);
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  function addSpec() {
    setSpecs((prev) => [...prev, { key: "", value: "" }]);
  }
  function updateSpec(index: number, field: "key" | "value", value: string) {
    setSpecs((prev) => prev.map((spec, i) => (i === index ? { ...spec, [field]: value } : spec)));
  }
  function removeSpec(index: number) {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected.slice(0, 5));
  }

  return (
    <form
      action={(formData) => {
        for (const file of files) formData.append("attachments", file);
        return formAction(formData);
      }}
      className="flex flex-col gap-6"
    >
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="rounded-2xl border border-ivory-300 bg-white p-6 sm:p-8">
      <section>
        <p className="text-xs font-semibold tracking-[0.15em] text-champagne-700 uppercase">Basics</p>
        <h2 className="mt-1 font-display text-lg font-medium text-espresso-950">What do you need?</h2>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            label="Request title"
            name="title"
            placeholder="e.g. 500 custom embroidered polo shirts"
            required
            disabled={isPending}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-espresso-800">
              Describe what you&apos;re looking for
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              required
              disabled={isPending}
              placeholder="Include as much detail as you can — style, use case, quality expectations, anything that helps us source the right thing."
              className="w-full rounded-lg border border-ivory-400 bg-white px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Quantity" name="quantity" type="number" min={1} required disabled={isPending} />
            <Input
              label="Unit (optional)"
              name="quantityUnit"
              placeholder="e.g. pieces, cartons, sets"
              disabled={isPending}
            />
          </div>
          {categories.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="categoryId" className="text-sm font-medium text-espresso-800">
                Closest category (optional)
              </label>
              <select
                id="categoryId"
                name="categoryId"
                disabled={isPending}
                defaultValue=""
                className="w-full rounded-lg border border-ivory-400 bg-white px-3.5 py-2.5 text-[15px] text-espresso-950 shadow-soft outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
              >
                <option value="">Not sure / other</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8 border-t border-ivory-200 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] text-champagne-700 uppercase">Specifications</p>
            <h2 className="mt-1 font-display text-lg font-medium text-espresso-950">Extra detail (optional)</h2>
          </div>
          <button
            type="button"
            onClick={addSpec}
            className="flex items-center gap-1 text-sm font-medium text-forest-800 hover:underline"
          >
            <Plus className="size-3.5" /> Add detail
          </button>
        </div>
        <p className="mt-1 text-sm text-espresso-900/50">
          Size, color, material, brand preference, customization, packaging — anything specific.
        </p>
        {specs.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3">
            {specs.map((spec, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  name="specKey"
                  value={spec.key}
                  onChange={(e) => updateSpec(index, "key", e.target.value)}
                  placeholder="e.g. Color"
                  disabled={isPending}
                  className="w-1/3 rounded-lg border border-ivory-400 bg-white px-3 py-2 text-sm text-espresso-950 outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
                />
                <input
                  name="specValue"
                  value={spec.value}
                  onChange={(e) => updateSpec(index, "value", e.target.value)}
                  placeholder="e.g. Navy blue"
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-ivory-400 bg-white px-3 py-2 text-sm text-espresso-950 outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
                />
                <button
                  type="button"
                  onClick={() => removeSpec(index)}
                  aria-label="Remove detail"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-espresso-900/35 hover:bg-ivory-100 hover:text-danger-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-8 border-t border-ivory-200 pt-6">
        <p className="text-xs font-semibold tracking-[0.15em] text-champagne-700 uppercase">Delivery</p>
        <h2 className="mt-1 font-display text-lg font-medium text-espresso-950">Where should it go?</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Destination country" name="deliveryCountry" required disabled={isPending} defaultValue="Ghana" />
          <Input label="Region (optional)" name="deliveryRegion" disabled={isPending} />
          <Input label="City (optional)" name="deliveryCity" disabled={isPending} />
        </div>
        <div className="mt-4">
          <Input
            label="Required by (optional)"
            name="requiredByDate"
            type="date"
            disabled={isPending}
            hint="Let us know if you're working to a deadline."
          />
        </div>
      </section>

      <section className="mt-8 border-t border-ivory-200 pt-6">
        <p className="text-xs font-semibold tracking-[0.15em] text-champagne-700 uppercase">Budget</p>
        <h2 className="mt-1 font-display text-lg font-medium text-espresso-950">Guide budget (optional)</h2>
        <p className="mt-1 text-sm text-espresso-900/50">
          A guide for our sourcing team — the final quotation may differ.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Budget amount" name="budgetAmount" type="number" min={0} step="0.01" disabled={isPending} />
          <Input label="Currency" name="budgetCurrency" placeholder="GHS" disabled={isPending} defaultValue="GHS" />
        </div>
      </section>

      <section className="mt-8 border-t border-ivory-200 pt-6">
        <p className="text-xs font-semibold tracking-[0.15em] text-champagne-700 uppercase">Evidence</p>
        <h2 className="mt-1 font-display text-lg font-medium text-espresso-950">Attachments (optional)</h2>
        <p className="mt-1 text-sm text-espresso-900/50">
          Photos, spec sheets, size breakdowns, logos — images, PDF, CSV, or Excel, up to 10MB each, up to 5 files.
        </p>
        <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-ivory-400 bg-ivory-50 px-6 py-8 text-center hover:bg-ivory-100">
          <UploadCloud className="size-6 text-espresso-900/35" strokeWidth={1.5} />
          <span className="text-sm font-medium text-espresso-800">Click to choose files</span>
          <input
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            disabled={isPending}
            className="hidden"
          />
        </label>
        {files.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {files.map((file, index) => (
              <li key={index} className="flex items-center justify-between text-sm text-espresso-900/65">
                <span className="truncate pr-2">
                  {file.name} ({Math.round(file.size / 1024)}KB)
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="text-espresso-900/35 hover:text-danger-600"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      </div>

      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
