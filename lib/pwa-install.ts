/**
 * Pure, DOM-light helpers for the install-education prompt (M16.1) — kept
 * free of React so platform/route/dismissal logic can be unit tested
 * without rendering anything. All localStorage access is wrapped in
 * try/catch (private browsing / storage-disabled contexts can throw).
 */

export const DISMISS_STORAGE_KEY = "csg-install-prompt-dismissed-at";
export const INSTALLED_STORAGE_KEY = "csg-install-prompt-installed";
export const DISMISS_DAYS = 7;
export const SHOW_DELAY_MS = 2500;
/** DOM id of the install card's primary CTA — only one InstallPrompt is ever mounted, so InstructionSheet can return focus to it by id rather than a threaded ref. */
export const INSTALL_CTA_ID = "csg-install-cta";

export type InstallPlatform = "ios" | "android";

/** UA-based only; iPadOS 13+ (which reports as "Macintosh") is detected separately via touch-point count where DOM APIs are available. */
export function detectPlatform(userAgent: string): InstallPlatform | null {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return null;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const matchesDisplayMode = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosLegacyStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return matchesDisplayMode || iosLegacyStandalone;
}

/**
 * Suppressed on checkout/payment, cart (its own fixed mobile checkout bar —
 * a second floating element would crowd it), auth, admin, and vendor
 * operational pages. Prefix match so nested routes (e.g. /checkout/[id]/payment) are covered.
 */
const SUPPRESSED_PATH_PREFIXES = [
  "/checkout",
  "/cart",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/admin",
  "/vendor",
];

export function isSuppressedRoute(pathname: string): boolean {
  return SUPPRESSED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function isDismissedRecently(now: number = Date.now()): boolean {
  const dismissedAt = readDismissedAt();
  if (dismissedAt === null) return false;
  return now - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function persistDismissal(now: number = Date.now()): void {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(now));
  } catch {
    // Best-effort only — the prompt just re-shows next visit if this fails.
  }
}

export function readInstalledFlag(): boolean {
  try {
    return window.localStorage.getItem(INSTALLED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function persistInstalledFlag(): void {
  try {
    window.localStorage.setItem(INSTALLED_STORAGE_KEY, "true");
  } catch {
    // Best-effort only.
  }
}
