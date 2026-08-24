import type { MetadataRoute } from "next";

/**
 * Installability only (M16) — not an offline app. background_color/
 * theme_color match the site's actual chrome (globals.css --color-ivory-50,
 * the sticky header's bg-ivory-50/90) so there's no flash between the OS
 * splash screen and the real page. Icons live in /public/icons — see
 * app/icon.png / app/apple-icon.png / app/favicon.ico for the separate
 * browser-tab/bookmark icon conventions Next.js picks up automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CrownSourceGlobal",
    short_name: "CrownSource",
    description: "Premium beauty commerce and global product sourcing — shop, source, and manage orders with CrownSourceGlobal.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fdfbf7",
    theme_color: "#fdfbf7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
