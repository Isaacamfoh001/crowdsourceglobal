"use client";

import { useEffect } from "react";

/**
 * Registers the no-op passthrough service worker (public/sw.js) in
 * production only — Android Chrome's native "Install app" treatment
 * requires one to be registered; iOS Safari does not use it at all. Never
 * registered in development, to keep local iteration free of any
 * service-worker-related caching surprises even though the worker itself
 * caches nothing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability enhancement only — silently no-op if registration
      // fails; the site must keep working normally either way.
    });
  }, []);

  return null;
}
