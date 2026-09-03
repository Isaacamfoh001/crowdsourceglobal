"use client";

import { useActionState, useState } from "react";
import { UploadCloud, Store, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { updateStoreLogoAction, removeStoreLogoAction } from "../../lib/actions/vendor-store";
import type { Result } from "../../lib/result";

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

/**
 * Real store-logo upload (M29.1) — replaces the old "paste a URL" text
 * field. Same StorageProvider-backed upload convention as listing images,
 * just a single file instead of a gallery.
 */
export function VendorLogoUploader({ logoUrl }: { logoUrl: string | null }) {
  const [uploadState, uploadAction, isUploading] = useActionState(updateStoreLogoAction, null);
  const [removeState, setRemoveState] = useState<Result<null> | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    const result = await removeStoreLogoAction();
    setRemoveState(result);
    setIsRemoving(false);
  };

  const displayedImage = preview ?? logoUrl;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-espresso-800">Store logo</span>
      {uploadState && !uploadState.ok ? <FormMessage tone="error">{uploadState.error}</FormMessage> : null}
      {removeState && !removeState.ok ? <FormMessage tone="error">{removeState.error}</FormMessage> : null}

      <div className="flex items-center gap-4">
        {displayedImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- either a local object-URL preview or a resolved server logo URL
          <img src={displayedImage} alt="" className="size-16 shrink-0 rounded-full border border-ivory-300 object-cover" />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-ivory-300 bg-ivory-100 text-espresso-900/40">
            <Store className="size-6" strokeWidth={1.5} />
          </div>
        )}

        <form action={uploadAction} className="flex flex-col gap-2">
          <label className="flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ivory-400 bg-ivory-50 px-4 py-2 text-sm font-medium text-espresso-800 hover:bg-ivory-100">
            <UploadCloud className="size-4 text-espresso-900/35" strokeWidth={1.75} />
            Choose photo
            <input
              type="file"
              name="logo"
              accept={ACCEPTED_IMAGE_TYPES}
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" variant="secondary" disabled={isUploading || !preview}>
              {isUploading ? "Uploading…" : "Upload"}
            </Button>
            {logoUrl ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isRemoving}
                className="flex items-center gap-1.5 text-sm text-espresso-900/50 hover:text-danger-600 disabled:opacity-40"
              >
                <Trash2 className="size-3.5" />
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
      <p className="text-xs text-espresso-900/45">PNG, JPEG, or WEBP. Up to 5MB.</p>
    </div>
  );
}
