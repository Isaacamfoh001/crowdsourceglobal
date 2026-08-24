import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHOW_DELAY_MS, DISMISS_STORAGE_KEY, INSTALLED_STORAGE_KEY } from "../../lib/pwa-install";
import { InstallPrompt } from "./InstallPrompt";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function stubMatchMedia(standalone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({ matches: standalone && query === "(display-mode: standalone)" }) as MediaQueryList,
  );
}

/** Flushes the mount-effect's Promise.resolve().then() and, when given, the SHOW_DELAY_MS setTimeout. */
async function flushToVisible() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SHOW_DELAY_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  mockPathname = "/";
  stubMatchMedia(false);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("InstallPrompt — visibility gating", () => {
  it("shows the install card on iOS after the show delay", async () => {
    setUserAgent(IPHONE_UA);
    render(<InstallPrompt />);
    await flushToVisible();
    expect(screen.getByText("Add CrownSource to your phone")).toBeInTheDocument();
  });

  it("does not render before the show delay elapses", async () => {
    setUserAgent(IPHONE_UA);
    render(<InstallPrompt />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText("Add CrownSource to your phone")).not.toBeInTheDocument();
  });

  it("never renders when already running in standalone display mode", async () => {
    setUserAgent(IPHONE_UA);
    stubMatchMedia(true);
    render(<InstallPrompt />);
    await flushToVisible();
    expect(screen.queryByText("Add CrownSource to your phone")).not.toBeInTheDocument();
  });

  it("never renders on desktop (non-iOS, non-Android) user agents", async () => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36");
    render(<InstallPrompt />);
    await flushToVisible();
    expect(screen.queryByText("Add CrownSource to your phone")).not.toBeInTheDocument();
  });

  it("suppresses the prompt on checkout/cart/auth/admin/vendor routes", async () => {
    setUserAgent(IPHONE_UA);
    mockPathname = "/checkout/order123/payment";
    render(<InstallPrompt />);
    await flushToVisible();
    expect(screen.queryByText("Add CrownSource to your phone")).not.toBeInTheDocument();
  });

  it("does not show again within 7 days of a prior dismissal", async () => {
    setUserAgent(IPHONE_UA);
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    render(<InstallPrompt />);
    await flushToVisible();
    expect(screen.queryByText("Add CrownSource to your phone")).not.toBeInTheDocument();
  });
});

describe("InstallPrompt — dismissal", () => {
  it("persists dismissal and hides the card when 'Not now' is clicked", async () => {
    setUserAgent(IPHONE_UA);
    render(<InstallPrompt />);
    await flushToVisible();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByText("Add CrownSource to your phone")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).not.toBeNull();
  });
});

describe("InstallPrompt — iOS instruction mode", () => {
  it("shows the manual Share → Add to Home Screen steps and returns focus to the CTA on close", async () => {
    setUserAgent(IPHONE_UA);
    render(<InstallPrompt />);
    await flushToVisible();

    const cta = screen.getByRole("button", { name: "Add to Home Screen" });
    fireEvent.click(cta);

    expect(screen.getByRole("dialog", { name: "Add to Home Screen" })).toBeInTheDocument();
    expect(screen.getByText("Tap the Share button in Safari")).toBeInTheDocument();
    expect(screen.getByText('Choose "Add to Home Screen"')).toBeInTheDocument();
    expect(screen.getByText('Tap "Add"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(cta);
  });

  it("closes the instruction sheet on Escape", async () => {
    setUserAgent(IPHONE_UA);
    render(<InstallPrompt />);
    await flushToVisible();

    fireEvent.click(screen.getByRole("button", { name: "Add to Home Screen" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("InstallPrompt — Android beforeinstallprompt", () => {
  it("triggers the native prompt and marks installed on 'accepted'", async () => {
    setUserAgent(ANDROID_UA);
    render(<InstallPrompt />);

    const promptSpy = vi.fn().mockResolvedValue(undefined);
    const bipEvent = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    };
    bipEvent.prompt = promptSpy;
    bipEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "android" });
    await act(async () => {
      window.dispatchEvent(bipEvent);
    });

    await flushToVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to Home Screen" }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(promptSpy).toHaveBeenCalledTimes(1);
    // No fallback instruction sheet — the native browser prompt handled it.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Add CrownSource to your phone")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(INSTALLED_STORAGE_KEY)).toBe("true");
  });

  it("persists a dismissal (not an install) when the native prompt outcome is 'dismissed'", async () => {
    setUserAgent(ANDROID_UA);
    render(<InstallPrompt />);

    const bipEvent = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    };
    bipEvent.prompt = vi.fn().mockResolvedValue(undefined);
    bipEvent.userChoice = Promise.resolve({ outcome: "dismissed", platform: "android" });
    await act(async () => {
      window.dispatchEvent(bipEvent);
    });

    await flushToVisible();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to Home Screen" }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(window.localStorage.getItem(INSTALLED_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).not.toBeNull();
  });

  it("falls back to manual instructions when beforeinstallprompt never fired", async () => {
    setUserAgent(ANDROID_UA);
    render(<InstallPrompt />);
    await flushToVisible();

    fireEvent.click(screen.getByRole("button", { name: "Add to Home Screen" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Open your browser menu")).toBeInTheDocument();
  });
});
