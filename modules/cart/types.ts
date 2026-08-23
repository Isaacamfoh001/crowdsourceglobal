export type CartLineView = {
  id: string;
  listingId: string;
  title: string;
  categorySlug: string;
  primaryImage: string | null;
  quantity: number;
  moq: number;
  maxOq: number | null;
  availableQuantity: number;
  availabilityStatus: string;
  unitPrice: number;
  lineTotal: number;
  currency: string;
  hasBulkPricing: boolean;
  vendor: { id: string; companyName: string; storefrontSlug: string };
};

export type CartVendorGroup = {
  vendor: { id: string; companyName: string; storefrontSlug: string };
  lines: CartLineView[];
  subtotal: number;
};

export type CartView = {
  cartId: string | null;
  itemCount: number;
  vendorGroups: CartVendorGroup[];
  subtotal: number;
  currency: string;
};
