import { serializeDate, serializeMoney } from "../response";
import { absoluteResolutionAttachmentUrl } from "../images";
import type {
  CustomerCaseDetail,
  CustomerCaseSummary,
  OrderCancellationContext,
  VendorCaseDetail,
  VendorCaseSummary,
} from "../../../modules/resolutions/types";

/**
 * Mobile M26 read-only resolution-case visibility — the "smallest legitimate
 * action" CLAUDE.md/M26 §16 calls for when full case CREATION is out of
 * scope for this milestone (no mobile file-upload-capable form exists yet
 * for it; see docs/mobile/MOBILE_V1_PLAN.md's M26 section for the explicit
 * deferral). These mappers only ever expose what
 * modules/resolutions/service.ts's own customer-scoped read methods already
 * return — no new authorization or business logic here.
 */

export function toCustomerCaseSummaryDTO(row: CustomerCaseSummary) {
  return {
    id: row.id,
    caseNumber: row.caseNumber,
    status: row.status,
    statusLabel: row.statusLabel,
    issueType: row.issueType,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    createdAt: serializeDate(row.createdAt),
  };
}

export function toCustomerCaseDetailDTO(row: CustomerCaseDetail, currency: string) {
  return {
    ...toCustomerCaseSummaryDTO(row),
    customerDescription: row.customerDescription,
    customerSafeDecisionReason: row.customerSafeDecisionReason,
    items: row.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantityAffected: item.quantityAffected,
      purchasedQuantity: item.purchasedQuantity,
      unitPrice: serializeMoney(item.unitPrice, currency),
      issueType: item.issueType,
      requestedResolution: item.requestedResolution,
      approvedResolution: item.approvedResolution,
      approvedRefundAmount: item.approvedRefundAmount != null ? serializeMoney(item.approvedRefundAmount, currency) : null,
      replacementQuantity: item.replacementQuantity,
    })),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      isImage: a.mimeType.startsWith("image/"),
      url: absoluteResolutionAttachmentUrl(a.id),
    })),
    refunds: row.refunds.map((r) => ({
      id: r.id,
      amount: serializeMoney(r.amount, r.currency),
      status: r.status,
      approvedAt: r.approvedAt ? serializeDate(r.approvedAt) : null,
      processedAt: r.processedAt ? serializeDate(r.processedAt) : null,
    })),
    returns: row.returns.map((r) => ({ id: r.id, status: r.status, method: r.method, trackingReference: r.trackingReference })),
    replacements: row.replacements.map((r) => ({ id: r.id, quantity: r.quantity, replacementFulfilmentId: r.replacementFulfilmentId })),
    resolvedAt: row.resolvedAt ? serializeDate(row.resolvedAt) : null,
  };
}

/**
 * Vendor-facing resolution-case mapping (M29.1) — mirrors the web Vendor
 * Portal's deliberately restricted view exactly (M9 §46): no customer
 * identity, contact, description, decision reason, or refund/return/
 * replacement outcome. Only what modules/resolutions/service.ts's own
 * vendor-scoped read methods already return (VendorCaseSummary/
 * VendorCaseDetail) — no new field, no new authorization logic.
 */
export function toVendorCaseSummaryDTO(row: VendorCaseSummary) {
  return {
    id: row.id,
    caseNumber: row.caseNumber,
    status: row.status,
    statusLabel: row.statusLabel,
    issueType: row.issueType,
    fulfilmentId: row.fulfilmentId,
    orderNumber: row.orderNumber,
    createdAt: serializeDate(row.createdAt),
  };
}

export function toVendorCaseDetailDTO(row: VendorCaseDetail) {
  return {
    ...toVendorCaseSummaryDTO(row),
    items: row.items.map((item) => ({ description: item.description, quantityAffected: item.quantityAffected })),
  };
}

/**
 * Mobile "Report a problem" entry-point context (M29.1) — the exact same
 * OrderCancellationContext the web ReportProblemForm already uses (cover
 * both cancellation AND general issue reporting; eligibility is only
 * meaningful for cancellation, but item/fulfilment data is shared). Never
 * re-derives cancellation eligibility client-side — resolutionsService's
 * existing classifyCancellationEligibility is the sole source of truth.
 */
export function toResolutionContextDTO(context: OrderCancellationContext, currency: string) {
  return {
    orderId: context.orderId,
    orderNumber: context.orderNumber,
    fulfilments: context.fulfilments.map((f) => ({
      fulfilmentId: f.fulfilmentId,
      vendorName: f.vendorName,
      status: f.status,
      eligibility: f.eligibility,
      items: f.items.map((item) => ({
        orderItemId: item.orderItemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: serializeMoney(item.unitPrice, currency),
      })),
    })),
  };
}
