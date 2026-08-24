import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DISMISS_STORAGE_KEY,
  INSTALLED_STORAGE_KEY,
  detectPlatform,
  isDismissedRecently,
  isStandaloneDisplay,
  isSuppressedRoute,
  persistDismissal,
  persistInstalledFlag,
  readInstalledFlag,
} from "./pwa-install";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

describe("detectPlatform", () => {
  it("recognizes iPhone/iPad/iPod user agents as ios", () => {
    expect(detectPlatform(IPHONE_UA)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (iPod touch; CPU iPhone OS 17_5 like Mac OS X)")).toBe("ios");
  });

  it("recognizes Android user agents as android", () => {
    expect(detectPlatform(ANDROID_UA)).toBe("android");
  });

  it("returns null for desktop user agents", () => {
    expect(detectPlatform(DESKTOP_UA)).toBeNull();
  });
});

describe("isStandaloneDisplay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is true when the display-mode: standalone media query matches", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(display-mode: standalone)" }) as MediaQueryList);
    expect(isStandaloneDisplay()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("is true for iOS's legacy navigator.standalone flag even when the media query doesn't match", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }) as MediaQueryList);
    const originalStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
    Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
    expect(isStandaloneDisplay()).toBe(true);
    Object.defineProperty(window.navigator, "standalone", { value: originalStandalone, configurable: true });
    vi.unstubAllGlobals();
  });

  it("is false in a normal browser tab", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }) as MediaQueryList);
    expect(isStandaloneDisplay()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("isSuppressedRoute", () => {
  it("suppresses checkout, payment, cart, auth, admin, and vendor routes", () => {
    expect(isSuppressedRoute("/checkout")).toBe(true);
    expect(isSuppressedRoute("/checkout/abc123/payment")).toBe(true);
    expect(isSuppressedRoute("/checkout/quote/xyz")).toBe(true);
    expect(isSuppressedRoute("/cart")).toBe(true);
    expect(isSuppressedRoute("/sign-in")).toBe(true);
    expect(isSuppressedRoute("/admin")).toBe(true);
    expect(isSuppressedRoute("/admin/quotations/1")).toBe(true);
    expect(isSuppressedRoute("/vendor/portal")).toBe(true);
    expect(isSuppressedRoute("/vendor/onboarding/business")).toBe(true);
  });

  it("does not suppress ordinary marketplace/account routes", () => {
    expect(isSuppressedRoute("/")).toBe(false);
    expect(isSuppressedRoute("/shop")).toBe(false);
    expect(isSuppressedRoute("/listings/abc")).toBe(false);
    expect(isSuppressedRoute("/account/orders")).toBe(false);
  });

  it("does not false-positive on routes that merely share a prefix substring", () => {
    // /admin-something is not /admin — prefix matching must respect the path segment boundary.
    expect(isSuppressedRoute("/admin-events")).toBe(false);
  });
});

describe("dismissal persistence", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is not dismissed when nothing has been persisted", () => {
    expect(isDismissedRecently()).toBe(false);
  });

  it("is dismissed immediately after persisting", () => {
    const now = Date.now();
    persistDismissal(now);
    expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe(String(now));
    expect(isDismissedRecently(now)).toBe(true);
  });

  it("stays suppressed for under 7 days, then expires", () => {
    const now = Date.now();
    persistDismissal(now);
    const sixDaysLater = now + 6 * 24 * 60 * 60 * 1000;
    const eightDaysLater = now + 8 * 24 * 60 * 60 * 1000;
    expect(isDismissedRecently(sixDaysLater)).toBe(true);
    expect(isDismissedRecently(eightDaysLater)).toBe(false);
  });

  it("does not throw when localStorage access fails (e.g. private browsing)", () => {
    const getSpy = vi.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(() => isDismissedRecently()).not.toThrow();
    expect(isDismissedRecently()).toBe(false);
    getSpy.mockRestore();

    const setSpy = vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(() => persistDismissal()).not.toThrow();
    setSpy.mockRestore();
  });
});

describe("installed flag persistence", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips through localStorage", () => {
    expect(readInstalledFlag()).toBe(false);
    persistInstalledFlag();
    expect(window.localStorage.getItem(INSTALLED_STORAGE_KEY)).toBe("true");
    expect(readInstalledFlag()).toBe(true);
  });
});
