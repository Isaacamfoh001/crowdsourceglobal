import { describe, expect, it } from "vitest";
import { resolveUnitPrice } from "./resolveUnitPrice";
import type { PublicBulkPriceTier } from "./types";

const tiers: PublicBulkPriceTier[] = [
  { id: "t1", minQuantity: 1, maxQuantity: 9, unitPrice: 100 },
  { id: "t2", minQuantity: 10, maxQuantity: 49, unitPrice: 90 },
  { id: "t3", minQuantity: 50, maxQuantity: null, unitPrice: 80 },
];

describe("resolveUnitPrice", () => {
  it("returns the base price when there are no tiers", () => {
    expect(resolveUnitPrice(120, [], 5)).toBe(120);
  });

  it("returns the base price when quantity is zero or negative", () => {
    expect(resolveUnitPrice(120, tiers, 0)).toBe(120);
    expect(resolveUnitPrice(120, tiers, -3)).toBe(120);
  });

  it("resolves the first tier for a quantity within its range", () => {
    expect(resolveUnitPrice(120, tiers, 5)).toBe(100);
  });

  it("resolves the correct tier exactly at a lower boundary", () => {
    expect(resolveUnitPrice(120, tiers, 10)).toBe(90);
  });

  it("resolves the correct tier exactly at an upper boundary", () => {
    expect(resolveUnitPrice(120, tiers, 49)).toBe(90);
  });

  it("resolves the open-ended top tier for a large quantity", () => {
    expect(resolveUnitPrice(120, tiers, 60)).toBe(80);
    expect(resolveUnitPrice(120, tiers, 5000)).toBe(80);
  });

  it("falls back to base price for a quantity below the lowest tier", () => {
    const highMoqTiers: PublicBulkPriceTier[] = [
      { id: "t1", minQuantity: 6, maxQuantity: 23, unitPrice: 35 },
    ];
    expect(resolveUnitPrice(40, highMoqTiers, 3)).toBe(40);
  });
});
