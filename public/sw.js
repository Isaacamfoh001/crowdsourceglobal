// CrownSourceGlobal service worker — installability only (M16).
//
// This project is not offline-first (see PROJECT.md / CLAUDE.md). Chrome's
// Android installability criteria for the native "Install app" (standalone,
// no browser chrome) treatment — as opposed to a plain bookmark shortcut —
// includes a registered service worker with a fetch event handler. iOS
// Safari has no such requirement; this file exists for that Android/Chrome
// gap only.
//
// It does not cache anything and must never diverge from normal network
// behavior: every request — auth, OAuth, API routes, checkout, payments,
// webhooks, account/vendor/admin pages, uploaded files — is forwarded to
// the network completely unmodified. No offline fallback, no stale
// responses, nothing intercepted or rewritten.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
