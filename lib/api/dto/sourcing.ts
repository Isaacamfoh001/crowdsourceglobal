import { absoluteSourcingAttachmentUrl } from "../images";
import { serializeDate } from "../response";
import type { SourcingRequestDetailView, SourcingRequestSummaryView } from "../../../modules/sourcing/types";

/**
 * Customer-facing sourcing-request DTOs (M24). Mirror the web
 * SourcingRequestSummaryView/DetailView shapes exactly — never adds a
 * field the web customer surface doesn't already expose (no options/
 * allocations/staff identity, per modules/sourcing/types.ts's own doc
 * comment on those views).
 */
export function toSourcingRequestSummaryDTO(request: SourcingRequestSummaryView) {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    title: request.title,
    quantity: request.quantity,
    quantityUnit: request.quantityUnit,
    status: request.status,
    statusLabel: request.statusLabel,
    submittedAt: serializeDate(request.submittedAt),
    hasQuotation: request.hasQuotation,
    thumbnail:
      request.primaryAttachment && request.primaryAttachment.mimeType.startsWith("image/")
        ? absoluteSourcingAttachmentUrl(request.primaryAttachment.id)
        : null,
  };
}

export function toSourcingRequestDetailDTO(request: SourcingRequestDetailView) {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    status: request.status,
    statusLabel: request.statusLabel,
    title: request.title,
    description: request.description,
    quantity: request.quantity,
    quantityUnit: request.quantityUnit,
    specifications: request.specifications,
    requiredByDate: request.requiredByDate ? serializeDate(request.requiredByDate) : null,
    deliveryCountry: request.deliveryCountry,
    deliveryRegion: request.deliveryRegion,
    deliveryCity: request.deliveryCity,
    budgetAmount: request.budgetAmount,
    budgetCurrency: request.budgetCurrency,
    unableToSourceReason: request.unableToSourceReason,
    submittedAt: serializeDate(request.submittedAt),
    attachments: request.attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      isImage: attachment.mimeType.startsWith("image/"),
      url: absoluteSourcingAttachmentUrl(attachment.id),
    })),
    latestQuotation: request.latestQuotation
      ? {
          id: request.latestQuotation.id,
          reference: request.latestQuotation.reference,
          status: request.latestQuotation.status,
          total: request.latestQuotation.total,
          currency: request.latestQuotation.currency,
          issuedAt: serializeDate(request.latestQuotation.issuedAt),
        }
      : null,
  };
}
