"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { FormMessage } from "../ui/FormMessage";
import { submitBeautyProfessionalProfileAction } from "../../lib/actions/beauty-professionals";
import { beautyProfessionalImageUrl } from "../../lib/beauty-professional-images";
import type { VendorProfileView } from "../../modules/beauty-professionals/types";

type Category = { id: string; name: string; slug: string };

const MAX_HERO_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";

/**
 * Mirrors StoreProfileForm.tsx's shape (M22) — self-serve profile
 * create/edit, submitted for the ONE moderated decision (first-time public
 * approval) — see prisma/schema.prisma's BeautyProfessionalProfile doc
 * comment. Hero image is a real Choose/Take Photo upload (M22.1 §4) — no
 * pasted-URL field. `<input type="file">` present anywhere in the form
 * makes the browser submit it as multipart/form-data automatically; the
 * server action reads the File directly off FormData.
 */
export function BeautyProfessionalProfileForm({ profile, categories }: { profile: VendorProfileView | null; categories: Category[] }) {
  const [state, formAction, isPending] = useActionState(submitBeautyProfessionalProfileAction, null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingImageUrl = profile?.heroImage ? beautyProfessionalImageUrl(profile.heroImage) : null;
  const previewUrl = localPreview ?? (removed ? null : existingImageUrl);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError(null);
    if (!file) {
      setLocalPreview(null);
      return;
    }
    if (file.size > MAX_HERO_IMAGE_SIZE_BYTES) {
      setFileError("Photo must be under 5MB.");
      event.target.value = "";
      setLocalPreview(null);
      return;
    }
    setRemoved(false);
    setLocalPreview(URL.createObjectURL(file));
  }

  function onRemove() {
    setRemoved(true);
    setLocalPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state && state.ok ? (
        <FormMessage tone="success">
          {state.value.status === "PENDING" ? "Submitted for CrownSourceGlobal review." : "Profile updated."}
        </FormMessage>
      ) : null}

      <Input label="Professional / business display name" name="displayName" defaultValue={profile?.displayName ?? ""} required disabled={isPending} />

      <Textarea label="Bio" name="bio" defaultValue={profile?.bio ?? ""} disabled={isPending} placeholder="Tell customers about your work and experience." />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-espresso-800">Hero photo (optional)</label>

        {previewUrl ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed photo preview, not Next's image optimizer */}
            <img src={previewUrl} alt="" className="h-40 w-64 rounded-lg border border-ivory-300 object-cover" />
            <button
              type="button"
              onClick={onRemove}
              disabled={isPending}
              className="absolute -right-2 -top-2 rounded-full bg-espresso-950/80 px-2 py-1 text-xs font-semibold text-ivory-50 hover:bg-espresso-950"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex h-40 w-64 items-center justify-center rounded-lg border border-dashed border-ivory-400 bg-ivory-100 text-sm text-espresso-900/50">
            No photo yet
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          name="heroImage"
          accept={ACCEPTED_TYPES}
          onChange={onFileChange}
          disabled={isPending}
          className="mt-1 text-sm text-espresso-800 file:mr-3 file:rounded-lg file:border-0 file:bg-espresso-800 file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-ivory-50 hover:file:bg-espresso-900"
        />
        {fileError ? <p className="text-sm text-danger-700">{fileError}</p> : null}
        <p className="text-xs text-espresso-900/55">PNG, JPEG, or WEBP, up to 5MB. Your portfolio photos come from your approved Explore posts.</p>
        <input type="hidden" name="removeHeroImage" value={removed ? "true" : "false"} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-espresso-800">Specialties</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm text-espresso-800">
              <input
                type="checkbox"
                name="specialtyCategorySlugs"
                value={category.slug}
                defaultChecked={profile?.specialtyCategorySlugs.includes(category.slug) ?? false}
                className="size-4 rounded accent-espresso-800"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <Select label="Where do you offer services?" name="locationMode" defaultValue={profile?.locationMode ?? "PROVIDER_LOCATION"} disabled={isPending}>
        <option value="PROVIDER_LOCATION">At my location only</option>
        <option value="CUSTOMER_LOCATION">At the customer&apos;s location only</option>
        <option value="BOTH">Either — my location or the customer&apos;s</option>
      </Select>

      {profile?.status === "CHANGES_REQUESTED" && profile.changesRequestedReason ? (
        <FormMessage tone="error">CrownSourceGlobal requested changes: {profile.changesRequestedReason}</FormMessage>
      ) : null}

      <Button type="submit" size="lg" className="w-fit" disabled={isPending || Boolean(fileError)}>
        {isPending ? "Saving…" : profile ? "Save changes" : "Submit for review"}
      </Button>
    </form>
  );
}
