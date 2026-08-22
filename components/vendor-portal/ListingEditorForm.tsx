"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { MoneyInput, sanitizeMoneyInput as sanitizeMoneyText } from "../ui/MoneyInput";
import { FormMessage } from "../ui/FormMessage";
import { saveListingAction } from "../../lib/actions/vendor-listings";
import { listingImageUrl } from "../../lib/listing-images";
import { MAX_LISTING_IMAGES } from "../../modules/vendor-listings/image-validation";
import type { VendorListingDetail } from "../../modules/vendor-listings/types";

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

type Category = { id: string; name: string; children: { id: string; name: string }[] };
type TierRow = { minQuantity: string; maxQuantity: string; unitPrice: string };

export function ListingEditorForm({
  listing,
  categories,
  disabled,
}: {
  listing: VendorListingDetail;
  categories: Category[];
  disabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(saveListingAction, null);
  const content = listing.pendingChanges?.listing ?? listing;
  const initialTiers = listing.pendingChanges?.bulkPriceTiers ?? listing.bulkPriceTiers;
  const [tiers, setTiers] = useState<TierRow[]>(
    initialTiers.length > 0
      ? initialTiers.map((t) => ({
          minQuantity: String(t.minQuantity),
          maxQuantity: t.maxQuantity != null ? String(t.maxQuantity) : "",
          unitPrice: String(t.unitPrice),
        }))
      : [],
  );

  function updateTier(index: number, field: keyof TierRow, value: string) {
    setTiers((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  // Existing, already-uploaded images (kept unless the vendor removes one)
  // and newly selected files pending upload on submit. The first entry
  // across existing-then-new is the primary image — there's no reordering
  // UI (M13.1 brief), so a vendor who wants a new image primary removes
  // the existing ones first.
  const [existingImages, setExistingImages] = useState<string[]>(content.images);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const remainingSlots = MAX_LISTING_IMAGES - existingImages.length - newFiles.length;

  const newFilePreviews = useMemo(() => newFiles.map((file) => URL.createObjectURL(file)), [newFiles]);
  useEffect(() => {
    return () => {
      for (const url of newFilePreviews) URL.revokeObjectURL(url);
    };
  }, [newFilePreviews]);

  function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = ""; // allow re-selecting the same file after removing it
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
        <h2 className="font-display text-lg font-medium text-stone-900">Basic information</h2>
        <Input label="Title" name="title" defaultValue={content.title} required disabled={disabled || isPending} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-stone-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={content.description}
            required
            disabled={disabled || isPending}
            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-stone-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoryId" className="text-sm font-medium text-stone-700">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={content.categoryId}
            required
            disabled={disabled || isPending}
            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-stone-50"
          >
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
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700">Product images</span>
          <p className="text-xs text-stone-500">
            Up to {MAX_LISTING_IMAGES} images, PNG/JPEG/WEBP, 5MB each. The first image is used as the primary image
            shown on the catalogue and search results.
          </p>

          {existingImages.length > 0 || newFiles.length > 0 ? (
            <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {existingImages.map((key, index) => (
                <li key={key} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product photos served through our own storage-backed route, not Next's image optimizer (no sharp installed — see M13.1 report) */}
                  <img src={listingImageUrl(key)} alt="" className="size-full object-cover" />
                  {index === 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded bg-stone-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Primary
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setExistingImages((prev) => prev.filter((k) => k !== key))}
                    disabled={disabled || isPending}
                    aria-label="Remove image"
                    className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-white/90 text-stone-600 opacity-0 shadow-soft transition-opacity group-hover:opacity-100 hover:text-red-600 disabled:opacity-0"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
              {newFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200">
                  {newFilePreviews[index] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object-URL preview of a not-yet-uploaded file
                    <img src={newFilePreviews[index]} alt="" className="size-full object-cover" />
                  ) : null}
                  {existingImages.length === 0 && index === 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded bg-stone-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Primary
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== index))}
                    disabled={disabled || isPending}
                    aria-label={`Remove ${file.name}`}
                    className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-white/90 text-stone-600 opacity-0 shadow-soft transition-opacity group-hover:opacity-100 hover:text-red-600 disabled:opacity-0"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {remainingSlots > 0 ? (
            <label className="mt-1 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100">
              <UploadCloud className="size-4 text-stone-400" strokeWidth={1.75} />
              Choose images
              <input
                type="file"
                multiple
                accept={ACCEPTED_IMAGE_TYPES}
                onChange={handleImageSelect}
                disabled={disabled || isPending}
                className="hidden"
              />
            </label>
          ) : null}
          {imageError ? <p className="text-xs text-red-600">{imageError}</p> : null}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-stone-100 pt-6">
        <h2 className="font-display text-lg font-medium text-stone-900">Pricing &amp; inventory</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyInput
            label="Price"
            name="basePrice"
            defaultValue={content.basePrice}
            required
            disabled={disabled || isPending}
          />
          <Input
            label="MOQ (minimum order quantity)"
            name="moq"
            type="number"
            min={1}
            defaultValue={content.moq}
            hint="The smallest quantity a customer can buy."
            required
            disabled={disabled || isPending}
          />
          <Input
            label="Max order quantity (optional)"
            name="maxOq"
            type="number"
            min={1}
            defaultValue={content.maxOq ?? ""}
            disabled={disabled || isPending}
          />
          <Input
            label="Lead time in days (optional)"
            name="leadTimeDays"
            type="number"
            min={0}
            defaultValue={content.leadTimeDays ?? ""}
            disabled={disabled || isPending}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-stone-100 pt-6">
        <div>
          <h2 className="font-display text-lg font-medium text-stone-900">Bulk pricing (optional)</h2>
          <p className="mt-1 text-sm text-stone-500">
            Offer a lower unit price at higher quantities. Tiers must not overlap.
          </p>
        </div>

        {tiers.map((tier, index) => (
          <div key={index} className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 p-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500">From qty</label>
              <input
                type="number"
                name="tierMinQuantity"
                min={1}
                value={tier.minQuantity}
                onChange={(e) => updateTier(index, "minQuantity", e.target.value)}
                disabled={disabled || isPending}
                className="w-24 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500">To qty (optional)</label>
              <input
                type="number"
                name="tierMaxQuantity"
                min={1}
                value={tier.maxQuantity}
                onChange={(e) => updateTier(index, "maxQuantity", e.target.value)}
                disabled={disabled || isPending}
                className="w-24 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-500">Unit price (GH₵)</label>
              <input
                type="text"
                inputMode="decimal"
                name="tierUnitPrice"
                value={tier.unitPrice}
                onChange={(e) => updateTier(index, "unitPrice", sanitizeMoneyText(e.target.value))}
                disabled={disabled || isPending}
                className="w-28 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setTiers((rows) => rows.filter((_, i) => i !== index))}
              disabled={disabled || isPending}
              aria-label="Remove tier"
              className="flex size-8 items-center justify-center rounded-lg border border-stone-300 text-stone-500 hover:bg-stone-50 disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setTiers((rows) => [...rows, { minQuantity: "", maxQuantity: "", unitPrice: "" }])}
          disabled={disabled || isPending}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline disabled:opacity-40"
        >
          <Plus className="size-4" />
          Add a tier
        </button>
      </section>

      <Button type="submit" size="lg" disabled={disabled || isPending} className="w-fit">
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
