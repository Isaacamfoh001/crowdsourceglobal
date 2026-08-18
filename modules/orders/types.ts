export const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
] as const;

export type DeliveryInfo = {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region: string;
  notes?: string;
};

export type OrderItemView = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  vendor: { companyName: string; storefrontSlug: string } | null;
};

export type OrderVendorGroupView = {
  vendorName: string;
  items: OrderItemView[];
  subtotal: number;
};

export type OrderSummaryView = {
  id: string;
  orderNumber: string;
  createdAt: Date;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  itemCount: number;
};

export type OrderDetailView = {
  id: string;
  orderNumber: string;
  createdAt: Date;
  status: string;
  paymentStatus: string;
  subtotal: number;
  total: number;
  currency: string;
  deliveryInfo: DeliveryInfo;
  vendorGroups: OrderVendorGroupView[];
  latestPaymentStatus: string | null;
  /** Safe summary only — never internal provider debug data or an unmasked phone. */
  latestPayment: {
    reference: string;
    provider: string;
    method: string;
    network: string | null;
    phoneMasked: string | null;
    /** Card payments only (M10B) — brand/last4 only, never the PAN/CVV/PIN/OTP. */
    cardDisplay: { brand: string; last4: string } | null;
    amount: number;
    currency: string;
    initiatedAt: Date;
  } | null;
};
