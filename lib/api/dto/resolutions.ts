import { serializeDate, serializeMoney } from "../response";
import { absoluteResolutionAttachmentUrl } from "../images";
import type { CustomerCaseDetail, CustomerCaseSummary } from "../../../modules/resolutions/types";

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
