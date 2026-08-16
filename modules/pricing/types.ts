/**
 * Public, customer-facing bulk pricing tier. Deliberately excludes any
 * vendor cost/margin data — VendorCostRule has no equivalent public type
 * or accessor anywhere in this module.
 */
export type PublicBulkPriceTier = {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
};
