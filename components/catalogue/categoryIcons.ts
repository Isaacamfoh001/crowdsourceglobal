import {
  Brush,
  Droplet,
  Layers,
  type LucideIcon,
  Package,
  Palette,
  Scissors,
  Sparkles,
  Wand2,
} from "lucide-react";

/**
 * Presentation-only slug -> icon mapping. Categories don't carry an icon
 * field in the schema (deliberately — that's UI concern, not domain data);
 * this map is how the catalogue UI assigns a visual identity per category
 * without fabricating photography. Unmapped slugs fall back to `Package`.
 *
 * Beauty-first taxonomy (M14.3) — see prisma/reference-data.ts.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "hair-wigs": Wand2,
  wigs: Wand2,
  "closures-frontals": Layers,
  "bundles-extensions": Layers,
  "human-hair-bundles": Layers,
  "clip-ins-weaves": Scissors,
  "lashes-brows": Sparkles,
  "makeup-cosmetics": Palette,
  "hair-beauty-care": Droplet,
  skincare: Droplet,
  "hair-care": Droplet,
  "beauty-tools-accessories": Brush,
  "salon-professional": Scissors,
};

export function getCategoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICONS[slug] ?? Package;
}
