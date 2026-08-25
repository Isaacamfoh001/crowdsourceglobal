"use client";

import { useEffect, useRef } from "react";
import { Check, Share, SquarePlus, X } from "lucide-react";
import { INSTALL_CTA_ID, type InstallPlatform } from "../../lib/pwa-install";
import { Button } from "../ui/Button";

const IOS_STEPS = [
  { icon: Share, text: 'Tap the Share button in Safari' },
  { icon: SquarePlus, text: 'Choose "Add to Home Screen"' },
  { icon: Check, text: 'Tap "Add"' },
];

const ANDROID_FALLBACK_STEPS = [
  { icon: SquarePlus, text: "Open your browser menu" },
  { icon: Check, text: 'Choose "Add to Home screen" or "Install app"' },
];

/**
 * Bottom-sheet dialog with the manual add-to-home-screen steps — the only
 * option on iOS Safari (no programmatic install API exists there) and the
 * fallback for Android browsers that never fired `beforeinstallprompt`.
 * Minimal hand-rolled focus trap/return (no new dependency): focuses the
 * close button on open, traps Tab within the sheet, restores focus to the
 * install card's CTA (INSTALL_CTA_ID) on close — there's only ever one
 * InstallPrompt mounted, so a fixed id is simpler than threading a ref
 * through Button, which doesn't forward refs.
 */
export function InstructionSheet({
  platform,
  onClose,
}: {
  platform: InstallPlatform;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    return () => {
      document.getElementById(INSTALL_CTA_ID)?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const steps = platform === "ios" ? IOS_STEPS : ANDROID_FALLBACK_STEPS;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso-950/40 sm:items-center" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-sheet-title"
        className="w-full max-w-sm rounded-t-2xl border border-ivory-300 bg-ivory-50 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-lifted sm:rounded-2xl sm:pb-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="install-sheet-title" className="font-display text-lg font-medium text-espresso-950">
            Add to Home Screen
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close instructions"
            className="shrink-0 rounded-md p-1 text-espresso-900/40 hover:bg-ivory-200 hover:text-espresso-900"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <ol className="mt-5 flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={step.text} className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-espresso-900 text-sm font-semibold text-champagne-300">
                {index + 1}
              </span>
              <step.icon className="size-4 shrink-0 text-espresso-900/50" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-sm text-espresso-900/85">{step.text}</span>
            </li>
          ))}
        </ol>

        <Button variant="primary" size="md" fullWidth className="mt-6" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}
