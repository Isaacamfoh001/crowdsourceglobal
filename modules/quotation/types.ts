/**
 * Cookie-carried pre-issuance line — deliberately NOT a persisted row (see
 * schema.prisma's M5 section comment). Never trusted for price; only
 * listingId/quantity survive between "add to quote" and "generate quote".
 */
export type QuoteDraftLine = {
  listingId: string;
  quantity: number;
};

/**
 * Server-computed preview of a draft line for the Quote Builder page —
 * cosmetic only, exactly like Cart's live preview. The authoritative
 * snapshot is always recomputed fresh inside the generate-quote transaction.
 */
export type QuoteDraftLineView = {
  listingId: string;
  title: string;
  vendor: { id: string; companyName: string; storefrontSlug: string };
  quantity: number;
  moq: number;
  maxOq: number | null;
  unitPrice: number;
  lineTotal: number;
  currency: string;
  /** False when the listing is no longer approved/active — line must be removed before generating. */
  stillEligible: boolean;
};

export type QuotationLineItemView = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  vendor: { companyName: string; storefrontSlug: string } | null;
};

/** ISSUED-but-past-`expiresAt` is displayed as EXPIRED without waiting on a background sweep. */
export type QuotationEffectiveStatus = "ISSUED" | "ACCEPTED" | "EXPIRED";

export type QuotationSummaryView = {
  id: string;
  reference: string;
  issuedAt: Date;
  expiresAt: Date;
  status: QuotationEffectiveStatus;
  total: number;
  currency: string;
  itemCount: number;
};

export type QuotationDetailView = {
  id: string;
  reference: string;
  issuedAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  status: QuotationEffectiveStatus;
  currency: string;
  subtotal: number;
  total: number;
  items: QuotationLineItemView[];
  acceptedOrderId: string | null;
};

export type AdminQuotationSummaryView = QuotationSummaryView & {
  customerName: string;
  customerEmail: string;
};

export type AdminQuotationDetailView = Omit<QuotationDetailView, "items"> & {
  customerName: string;
  customerEmail: string;
  /** Admin-only — never present on the customer-facing DTO. */
  items: (QuotationLineItemView & { vendorPayableBasis: number })[];
};
