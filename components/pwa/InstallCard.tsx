"use client";

import { Smartphone, X } from "lucide-react";
import { INSTALL_CTA_ID } from "../../lib/pwa-install";
import { Button } from "../ui/Button";

/**
 * Compact, dismissible bottom card — not a full-screen modal. Positioned
 * with env(safe-area-inset-bottom) so it clears the iPhone home indicator;
 * routes with their own fixed bottom bar (e.g. /cart) suppress this
 * entirely rather than stacking (see lib/pwa-install.ts).
 */
export function InstallCard({
  onInstallClick,
  onDismiss,
}: {
  onInstallClick: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Install CrownSourceGlobal"
      className="fixed inset-x-4 z-40 rounded-2xl border border-ivory-300 bg-ivory-50 p-4 shadow-lifted"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-espresso-900 text-champagne-300">
          <Smartphone className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-espresso-950">Add CrownSource to your phone</p>
          <p className="mt-1 text-xs leading-relaxed text-espresso-900/65">
            Get faster access to shopping, sourcing, orders and your account from your home screen.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button id={INSTALL_CTA_ID} variant="primary" size="sm" onClick={onInstallClick}>
              Add to Home Screen
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Not now
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 rounded-md p-1 text-espresso-900/40 hover:bg-ivory-200 hover:text-espresso-900"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
