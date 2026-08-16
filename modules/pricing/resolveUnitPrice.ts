import type { PublicBulkPriceTier } from "./types";

/**
 * Pure function — no Prisma/server dependencies — so it can be imported
 * both server-side (the actual authoritative calculation, at add-to-cart
 * and checkout time) and client-side (a live price preview on the listing
 * page). The preview is cosmetic only: every place that charges or records
 * a price recomputes this server-side against freshly-read tiers, never
 * trusting whatever the client displayed.
 *
 * Tiers are assumed non-overlapping and sorted ascending by minQuantity
 * (true of anything read via modules/pricing repository). Returns the
 * listing's base price when no tier matches the requested quantity.
 */
export function resolveUnitPrice(
  basePrice: number,
  tiers: PublicBulkPriceTier[],
  quantity: number,
): number {
  if (quantity <= 0 || tiers.length === 0) {
    return basePrice;
  }

  const matchingTier = tiers.find(
    (tier) => quantity >= tier.minQuantity && (tier.maxQuantity === null || quantity <= tier.maxQuantity),
  );

  return matchingTier ? matchingTier.unitPrice : basePrice;
}
