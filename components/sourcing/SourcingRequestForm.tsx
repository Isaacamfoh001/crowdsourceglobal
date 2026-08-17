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

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-display text-lg font-medium text-stone-900">What do you need?</h2>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            label="Request title"
            name="title"
            placeholder="e.g. 500 custom embroidered polo shirts"
            required
            disabled={isPending}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-stone-700">
              Describe what you&apos;re looking for
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              required
              disabled={isPending}
              placeholder="Include as much detail as you can — style, use case, quality expectations, anything that helps us source the right thing."
              className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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
              <label htmlFor="categoryId" className="text-sm font-medium text-stone-700">
                Closest category (optional)
              </label>
              <select
                id="categoryId"
                name="categoryId"
                disabled={isPending}
                defaultValue=""
                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-stone-900">Specifications (optional)</h2>
          <button
            type="button"
            onClick={addSpec}
            className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
          >
            <Plus className="size-3.5" /> Add detail
          </button>
        </div>
        <p className="mt-1 text-sm text-stone-500">
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
                  className="w-1/3 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                />
                <input
                  name="specValue"
                  value={spec.value}
                  onChange={(e) => updateSpec(index, "value", e.target.value)}
                  placeholder="e.g. Navy blue"
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => removeSpec(index)}
                  aria-label="Remove detail"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-display text-lg font-medium text-stone-900">Delivery</h2>
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

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-display text-lg font-medium text-stone-900">Budget (optional)</h2>
        <p className="mt-1 text-sm text-stone-500">
          A guide for our sourcing team — the final quotation may differ.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Budget amount" name="budgetAmount" type="number" min={0} step="0.01" disabled={isPending} />
          <Input label="Currency" name="budgetCurrency" placeholder="GHS" disabled={isPending} defaultValue="GHS" />
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-display text-lg font-medium text-stone-900">Attachments (optional)</h2>
        <p className="mt-1 text-sm text-stone-500">
          Photos, spec sheets, size breakdowns, logos — images, PDF, CSV, or Excel, up to 10MB each, up to 5 files.
        </p>
        <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-8 text-center hover:bg-stone-100">
          <UploadCloud className="size-6 text-stone-400" strokeWidth={1.5} />
          <span className="text-sm font-medium text-stone-700">Click to choose files</span>
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
              <li key={index} className="flex items-center justify-between text-sm text-stone-600">
                <span className="truncate pr-2">
                  {file.name} ({Math.round(file.size / 1024)}KB)
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="text-stone-400 hover:text-red-600"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
