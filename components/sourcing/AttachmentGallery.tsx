"use client";

import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import type { SourcingRequestAttachmentView } from "../../modules/sourcing/types";

/**
 * Admin/staff attachment review (M24 §15). Previously a bare filename link
 * list — staff had to open each file in a new tab one at a time to compare
 * them, the same gap flagged for Listing moderation. Images now render as a
 * thumbnail grid with a lightbox for a full-size look before an operational
 * decision; non-image files (spec sheets/spreadsheets) stay a plain
 * download list. Every `<img>`/link still points at the existing private,
 * session-authenticated `/api/sourcing/attachments/[id]` route — no new
 * storage/access path.
 */
export function AttachmentGallery({ attachments }: { attachments: SourcingRequestAttachmentView[] }) {
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const files = attachments.filter((a) => !a.mimeType.startsWith("image/"));
  const lightboxAttachment = attachments.find((a) => a.id === lightboxId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() => setLightboxId(attachment.id)}
              className="aspect-square overflow-hidden rounded-lg border border-ivory-300 bg-ivory-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private, session-authenticated attachment; not an optimizable static asset */}
              <img
                src={`/api/sourcing/attachments/${attachment.id}`}
                alt={attachment.filename}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((attachment) => (
            <li key={attachment.id}>
              <a
                href={`/api/sourcing/attachments/${attachment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-espresso-800 hover:underline"
              >
                <Paperclip className="size-3.5" />
                {attachment.filename}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {lightboxAttachment ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-espresso-950/85 p-6"
          onClick={() => setLightboxId(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxId(null)}
            aria-label="Close"
            className="absolute top-5 right-5 flex size-9 items-center justify-center rounded-full bg-ivory-50/10 text-ivory-50 hover:bg-ivory-50/20"
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- private, session-authenticated attachment; not an optimizable static asset */}
          <img
            src={`/api/sourcing/attachments/${lightboxAttachment.id}`}
            alt={lightboxAttachment.filename}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
