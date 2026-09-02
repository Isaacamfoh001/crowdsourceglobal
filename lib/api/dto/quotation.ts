import { serializeDate } from "../response";
import type { QuotationDetailView, QuotationSummaryView } from "../../../modules/quotation/types";

/**
 * Customer-facing quotation DTOs (M24). Mirror
 * QuotationSummaryView/QuotationDetailView exactly — never adds
 * vendorPayableBasis or any other admin-only field (see
 * modules/quotation/types.ts's AdminQuotationDetailView split).
 */
export function toQuotationSummaryDTO(quotation: QuotationSummaryView) {
  return {
    id: quotation.id,
    reference: quotation.reference,
    issuedAt: serializeDate(quotation.issuedAt),
    expiresAt: serializeDate(quotation.expiresAt),
    status: quotation.status,
    total: quotation.total,
    currency: quotation.currency,
    itemCount: quotation.itemCount,
  };
}

export function toQuotationDetailDTO(quotation: QuotationDetailView) {
  return {
    id: quotation.id,
    reference: quotation.reference,
    issuedAt: serializeDate(quotation.issuedAt),
    expiresAt: serializeDate(quotation.expiresAt),
    acceptedAt: quotation.acceptedAt ? serializeDate(quotation.acceptedAt) : null,
    status: quotation.status,
    currency: quotation.currency,
    subtotal: quotation.subtotal,
    total: quotation.total,
    items: quotation.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      vendor: item.vendor,
    })),
    acceptedOrderId: quotation.acceptedOrderId,
  };
}
