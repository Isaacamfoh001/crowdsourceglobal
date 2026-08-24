import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { ServiceWorkerRegistration } from "../components/pwa/ServiceWorkerRegistration";
import { InstallPrompt } from "../components/pwa/InstallPrompt";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CrownSourceGlobal",
    template: "%s — CrownSourceGlobal",
  },
  description:
    "Shop normally, buy in bulk with instant pricing, or ask CrownSourceGlobal to source something custom. A managed marketplace connecting buyers with approved vendors.",
  applicationName: "CrownSourceGlobal",
  appleWebApp: {
    // Required for iOS to launch the installed icon in standalone mode
    // (no Safari chrome) rather than opening a regular browser tab.
    capable: true,
    title: "CrownSource",
    statusBarStyle: "default",
  },
};

// themeColor/viewport live here (not in `metadata`) per current Next.js
// metadata API — matches the sticky header's bg-ivory-50/90
// (globals.css --color-ivory-50) so installed/standalone mode has no
// color mismatch against the real page chrome. viewportFit: "cover"
// enables env(safe-area-inset-*) for notches in standalone mode.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fdfbf7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
        <ServiceWorkerRegistration />
        <InstallPrompt />
      </body>
    </html>
  );
}
