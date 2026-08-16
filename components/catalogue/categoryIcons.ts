import {
  Armchair,
  Cpu,
  Factory,
  Laptop,
  type LucideIcon,
  Package,
  Paintbrush,
  Printer,
  Scissors,
  Shirt,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

/**
 * Presentation-only slug -> icon mapping. Categories don't carry an icon
 * field in the schema (deliberately — that's UI concern, not domain data);
 * this map is how the catalogue UI assigns a visual identity per category
 * without fabricating photography. Unmapped slugs fall back to `Package`.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "hair-beauty-supplies": Sparkles,
  "hair-extensions-wigs": Scissors,
  "skincare-cosmetics": Paintbrush,
  "electronics-accessories": Cpu,
  "phones-tablets": Smartphone,
  "computer-accessories": Laptop,
  "office-business-supplies": Package,
  "textiles-fabrics": Shirt,
  "home-kitchen": Armchair,
  "industrial-safety-equipment": Factory,
  "packaging-printing": Printer,
  "food-beverage-supplies": UtensilsCrossed,
};

export function getCategoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICONS[slug] ?? Package;
}
