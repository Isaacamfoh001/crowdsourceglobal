"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  type InstallPlatform,
  SHOW_DELAY_MS,
  detectPlatform,
  isDismissedRecently,
  isStandaloneDisplay,
  isSuppressedRoute,
  persistDismissal,
  persistInstalledFlag,
  readInstalledFlag,
} from "../../lib/pwa-install";
import { InstallCard } from "./InstallCard";
import { InstructionSheet } from "./InstructionSheet";

/** Chromium-only, not in the standard DOM lib. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function detectMobilePlatform(): InstallPlatform | null {
  const detected = detectPlatform(window.navigator.userAgent);
  if (detected) return detected;
  // iPadOS 13+ reports as "Macintosh" in its UA string but exposes touch points.
  const isIPadOS = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return isIPadOS ? "ios" : null;
}

/**
 * Install-education card (M16.1) — discoverability only, no change to the
 * manifest, service worker, or install mechanics themselves. Mounted
 * globally from the root layout; visibility is gated on platform, route,
 * standalone state, and 7-day dismissal persistence (see lib/pwa-install.ts).
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [eligible, setEligible] = useState(false);
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
    }
    function handleAppInstalled() {
      persistInstalledFlag();
      setVisible(false);
      setSheetOpen(false);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (isStandaloneDisplay() || readInstalledFlag()) return;
    const resolved = detectMobilePlatform();
    if (!resolved) return;
    // Deferred a tick so setState isn't called synchronously in the effect
    // body (matches the .then()-wrapped pattern used elsewhere, e.g.
    // components/auth/VerifyEmailContent.tsx).
    void Promise.resolve().then(() => {
      setPlatform(resolved);
      setEligible(true);
    });
  }, []);

  const suppressed = isSuppressedRoute(pathname ?? "");

  useEffect(() => {
    if (!eligible || !platform || suppressed) return;
    if (visible || isDismissedRecently()) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible, platform, suppressed, visible]);

  function handleDismiss() {
    persistDismissal();
    setVisible(false);
    setSheetOpen(false);
  }

  async function handleInstallClick() {
    if (platform === "android" && deferredPromptRef.current) {
      const promptEvent = deferredPromptRef.current;
      deferredPromptRef.current = null;
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        persistInstalledFlag();
      } else {
        persistDismissal();
      }
      setVisible(false);
      return;
    }
    // iOS has no programmatic install API; Android without a captured
    // native prompt falls back to the same manual-instructions sheet.
    setSheetOpen(true);
  }

  function handleSheetClose() {
    setSheetOpen(false);
  }

  if (!visible || !platform || suppressed) return null;

  return (
    <>
      <InstallCard onInstallClick={handleInstallClick} onDismiss={handleDismiss} />
      {sheetOpen ? <InstructionSheet platform={platform} onClose={handleSheetClose} /> : null}
    </>
  );
}
