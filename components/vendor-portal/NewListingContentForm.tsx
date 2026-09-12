"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { MoneyInput, sanitizeMoneyInput as sanitizeMoneyText } from "../ui/MoneyInput";
import { FormMessage } from "../ui/FormMessage";
import { submitNewListingAction } from "../../lib/actions/vendor-listings";
import { listingImageUrl } from "../../lib/listing-images";
import { MAX_LISTING_IMAGES } from "../../modules/vendor-listings/image-validation";
import type { VendorListingDetail } from "../../modules/vendor-listings/types";

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";
const OTHER_VALUE = "__other__";

type Category = { id: string; name: string; children: { id: string; name: string }[] };
type TierRow = { minQuantity: string; maxQuantity: string; unitPrice: string };

/**
 * M32.10 — the entire brand-new listing creation journey: photos, product
 * details, category, price, optional bulk pricing. No MOQ, no
 * inventory/availability, no lead time, no separate "Save" step. One
 * button — "Submit for review" — saves the content (against the DRAFT
 * `createListingAction` already created) and submits for moderation in a
 * single server action. Inventory/availability, MOQ-era fields, and lead
 * time stay editable later from Products → listing → Edit
 * (`ListingEditorForm`/`InventoryForm`), which this component intentionally
 * does not replace.
 */
export function NewListingContentForm({ listing, categories }: { listing: VendorListingDetail; categories: Category[] }) {
  const [state, formAction, isPending] = useActionState(submitNewListingAction, null);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [tiers, setTiers] = useState<TierRow[]>([]);

  function updateTier(index: number, field: keyof TierRow, value: string) {
    setTiers((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  const [existingImages, setExistingImages] = useState<string[]>(listing.images);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const remainingSlots = MAX_LISTING_IMAGES - existingImages.length - newFiles.length;
  const hasAtLeastOneImage = existingImages.length + newFiles.length > 0;

  const newFilePreviews = useMemo(() => newFiles.map((file) => URL.createObjectURL(file)), [newFiles]);
  useEffect(() => {
    return () => {
      for (const url of newFilePreviews) URL.revokeObjectURL(url);
    };
  }, [newFilePreviews]);

  function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;

    const accepted = selected.slice(0, Math.max(0, remainingSlots));
    setNewFiles((prev) => [...prev, ...accepted]);
    setImageError(
      selected.length > accepted.length ? `You can have up to ${MAX_LISTING_IMAGES} images per listing.` : null,
    );
  }

  return (
    <form
      action={(formData) => {
        for (const key of existingImages) formData.append("existingImages", key);
        for (const file of newFiles) formData.append("newImages", file);
        return formAction(formData);
      }}
      className="flex flex-col gap-8"
    >
      <input type="hidden" name="listingId" value={listing.id} />
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <section className="flex flex-col gap-4">
        <Input label="Product name" name="title" defaultValue={listing.title === "Untitled listing" ? "" : listing.title} required disabled={isPending} />
        <Textarea label="Description" id="description" name="description" rows={4} defaultValue={listing.description} required disabled={isPending} />
        <Select
          label="Category"
          id="categoryId"
          name={showOtherInput ? undefined : "categoryId"}
          defaultValue={listing.categoryId}
          required
          disabled={isPending}
          onChange={(event) => setShowOtherInput(event.target.value === OTHER_VALUE)}
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
        </Select>
        {showOtherInput ? (
          <Input label="What category is this?" name="categoryOther" placeholder="e.g. Hair tools, Party supplies" required disabled={isPending} />
        ) : null}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-espresso-800">Product images</span>
          <p className="text-xs text-espresso-900/50">
            Up to {MAX_LISTING_IMAGES} images, PNG/JPEG/WEBP, 5MB each. The first image is used as the primary image
            shown on the catalogue and search results.
          </p>

          {existingImages.length > 0 || newFiles.length > 0 ? (
            <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {existingImages.map((key, index) => (
                <li key={key} className="group relative aspect-square overflow-hidden rounded-lg border border-ivory-300">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product photos served through our own storage-backed route */}
                  <img src={listingImageUrl(key)} alt="" className="size-full object-cover" />
                  {index === 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded bg-espresso-950/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Primary
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setExistingImages((prev) => prev.filter((k) => k !== key))}
                    disabled={isPending}
                    aria-label="Remove image"
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-ivory-50/90 text-espresso-900/65 opacity-100 shadow-soft transition-opacity hover:text-danger-600 disabled:opacity-40 sm:size-6 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
              {newFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-ivory-300">
                  {newFilePreviews[index] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object-URL preview of a not-yet-uploaded file
                    <img src={newFilePreviews[index]} alt="" className="size-full object-cover" />
                  ) : null}
                  {existingImages.length === 0 && index === 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded bg-espresso-950/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Primary
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== index))}
                    disabled={isPending}
                    aria-label={`Remove ${file.name}`}
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-ivory-50/90 text-espresso-900/65 opacity-100 shadow-soft transition-opacity hover:text-danger-600 disabled:opacity-40 sm:size-6 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {remainingSlots > 0 ? (
            <label className="mt-1 flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm font-medium text-espresso-800 hover:bg-ivory-100">
              <UploadCloud className="size-4 text-espresso-900/35" strokeWidth={1.75} />
              Choose images
              <input type="file" multiple accept={ACCEPTED_IMAGE_TYPES} onChange={handleImageSelect} disabled={isPending} className="hidden" />
            </label>
          ) : null}
          {imageError ? <p className="text-xs text-danger-600">{imageError}</p> : null}
          {!hasAtLeastOneImage ? <p className="text-xs text-espresso-900/50">At least 1 photo is required.</p> : null}
        </div>

        <MoneyInput label="Price" name="basePrice" required disabled={isPending} />
      </section>

      <section className="flex flex-col gap-3 border-t border-ivory-100 pt-6">
        <div>
          <h2 className="font-display text-lg font-medium text-espresso-950">Bulk pricing (optional)</h2>
          <p className="mt-1 text-sm text-espresso-900/50">
            Offer a lower unit price at higher quantities. Tiers must not overlap.
          </p>
        </div>

        {tiers.map((tier, index) => (
          <div key={index} className="flex flex-wrap items-end gap-3 rounded-xl border border-ivory-300 bg-ivory-50/60 p-3">
            <div className="flex min-w-[5.5rem] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-espresso-900/50">From qty</label>
              <input
                type="number"
                name="tierMinQuantity"
                min={1}
                value={tier.minQuantity}
                onChange={(e) => updateTier(index, "minQuantity", e.target.value)}
                disabled={isPending}
                className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex min-w-[5.5rem] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-espresso-900/50">To qty (optional)</label>
              <input
                type="number"
                name="tierMaxQuantity"
                min={1}
                value={tier.maxQuantity}
                onChange={(e) => updateTier(index, "maxQuantity", e.target.value)}
                disabled={isPending}
                className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex min-w-[6.5rem] flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-espresso-900/50">Unit price (GH₵)</label>
              <input
                type="text"
                inputMode="decimal"
                name="tierUnitPrice"
                value={tier.unitPrice}
                onChange={(e) => updateTier(index, "unitPrice", sanitizeMoneyText(e.target.value))}
                disabled={isPending}
                className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setTiers((rows) => rows.filter((_, i) => i !== index))}
              disabled={isPending}
              aria-label="Remove tier"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-ivory-400 bg-ivory-50 text-espresso-900/50 hover:bg-ivory-50 disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setTiers((rows) => [...rows, { minQuantity: "", maxQuantity: "", unitPrice: "" }])}
          disabled={isPending}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-espresso-800 hover:underline disabled:opacity-40"
        >
          <Plus className="size-4" />
          Add a tier
        </button>
      </section>

      <div className="flex flex-col gap-1.5">
        <Button type="submit" size="lg" disabled={isPending || !hasAtLeastOneImage} className="w-fit">
          {isPending ? "Submitting…" : "Submit for review"}
        </Button>
        <p className="text-xs text-espresso-900/50">
          This creates your listing, uploads your photos, and sends it for review — all in one step.
        </p>
      </div>
    </form>
  );
}
