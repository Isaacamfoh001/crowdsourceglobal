import { serializeMoney, serializeDate } from "../response";
import { absoluteImageUrl, absoluteBeautyProfessionalImageUrl, absoluteServiceRequestImageUrl, absoluteSourcingAttachmentUrl } from "../images";
import type { VendorApplicationView } from "../../../modules/vendor-applications/types";
import type { VendorListingSummary, VendorListingDetail } from "../../../modules/vendor-listings/types";
import type { VendorFulfilmentSummary, VendorFulfilmentDetail } from "../../../modules/fulfilment/types";
import type {
  VendorFinanceOverview,
  VendorEarningSummaryView,
  VendorEarningDetailView,
  VendorSettlementSummaryView,
  VendorSettlementDetailView,
  PayoutDestinationView,
} from "../../../modules/vendor-finance/types";
import type { VendorProfileView } from "../../../modules/beauty-professionals/types";
import type { VendorServiceView } from "../../../modules/beauty-services/types";
import type { ServiceRequestView } from "../../../modules/service-requests/types";
import type { VendorStoreProfile } from "../../../modules/vendors/types";
import type { VendorSolicitationDetailView, VendorSolicitationSummaryView } from "../../../modules/sourcing/types";

/**
 * M27 — shared DTO mappers for the mobile Vendor Mode API. Same convention
 * as `lib/api/dto/catalogue.ts`: these only add the M18.1 money/date/
 * image-URL response shaping on top of `modules/*`'s already vendor-safe
 * view types — no field is added or field-level authorization decided
 * here.
 */

export function toVendorApplicationDTO(app: VendorApplicationView) {
  return {
    id: app.id,
    status: app.status,
    sellerType: app.sellerType,
    contactName: app.contactName,
    contactEmail: app.contactEmail,
    contactPhone: app.contactPhone,
    displayName: app.displayName,
    legalName: app.legalName,
    storeDescription: app.storeDescription,
    registrationNumber: app.registrationNumber,
    taxIdentifier: app.taxIdentifier,
    yearEstablished: app.yearEstablished,
    websiteUrl: app.websiteUrl,
    country: app.country,
    region: app.region,
    city: app.city,
    addressLine1: app.addressLine1,
    categorySlugs: app.categorySlugs,
    sellingMode: app.sellingMode,
    bulkCapable: app.bulkCapable,
    leadTimeDaysDefault: app.leadTimeDaysDefault,
    serviceAreas: app.serviceAreas,
    submittedAt: app.submittedAt ? serializeDate(app.submittedAt) : null,
    reviewedAt: app.reviewedAt ? serializeDate(app.reviewedAt) : null,
    decisionReason: app.decisionReason,
    vendorId: app.vendorId,
  };
}

export function toVendorListingSummaryDTO(listing: VendorListingSummary) {
  return {
    id: listing.id,
    title: listing.title,
    price: serializeMoney(listing.basePrice, listing.currency),
    approvalStatus: listing.approvalStatus,
    listingStatus: listing.listingStatus,
    availabilityStatus: listing.availabilityStatus,
    availableQuantity: listing.availableQuantity,
    hasPendingChanges: listing.hasPendingChanges,
    changesRequestedReason: listing.changesRequestedReason,
    updatedAt: serializeDate(listing.updatedAt),
  };
}

/**
 * `images` is `{ key, url }[]`, not a plain resolved-URL array — a mobile
 * edit form needs the raw storage key (or legacy external URL — see
 * listingImageUrl's key-vs-external-URL branch) back verbatim as
 * `existingImages` on save, and the resolved `url` only to render a
 * preview. Returning resolved URLs alone would silently break "remove an
 * image simply by omitting its key" on every edit.
 */
export function toVendorListingDetailDTO(listing: VendorListingDetail) {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    images: listing.images.map((key) => ({ key, url: absoluteImageUrl(key) })),
    specs: listing.specs,
    price: serializeMoney(listing.basePrice, listing.currency),
    moq: listing.moq,
    maxOq: listing.maxOq,
    leadTimeDays: listing.leadTimeDays,
    availableQuantity: listing.availableQuantity,
    availabilityStatus: listing.availabilityStatus,
    approvalStatus: listing.approvalStatus,
    listingStatus: listing.listingStatus,
    submittedAt: listing.submittedAt ? serializeDate(listing.submittedAt) : null,
    changesRequestedReason: listing.changesRequestedReason,
    categoryId: listing.categoryId,
    bulkPriceTiers: listing.bulkPriceTiers.map((tier) => ({
      id: tier.id,
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      unitPrice: serializeMoney(tier.unitPrice, listing.currency),
    })),
    pendingChanges: listing.pendingChanges
      ? {
          listing: {
            ...listing.pendingChanges.listing,
            images: listing.pendingChanges.listing.images.map(absoluteImageUrl),
          },
          bulkPriceTiers: listing.pendingChanges.bulkPriceTiers,
        }
      : null,
  };
}

export function toVendorFulfilmentSummaryDTO(row: VendorFulfilmentSummary) {
  return {
    id: row.id,
    status: row.status,
    origin: row.origin,
    orderNumber: row.orderNumber,
    createdAt: serializeDate(row.createdAt),
    itemCount: row.itemCount,
    totalQuantity: row.totalQuantity,
    hasOpenIssue: row.hasOpenIssue,
  };
}

export function toVendorFulfilmentDetailDTO(row: VendorFulfilmentDetail) {
  return {
    id: row.id,
    status: row.status,
    origin: row.origin,
    orderNumber: row.orderNumber,
    createdAt: serializeDate(row.createdAt),
    itemCount: row.itemCount,
    totalQuantity: row.totalQuantity,
    hasOpenIssue: row.hasOpenIssue,
    items: row.items,
    leadTimeDaysDefault: row.leadTimeDaysDefault,
    shipment: row.shipment
      ? {
          ...row.shipment,
          collectionScheduledAt: row.shipment.collectionScheduledAt ? serializeDate(row.shipment.collectionScheduledAt) : null,
          collectedAt: row.shipment.collectedAt ? serializeDate(row.shipment.collectedAt) : null,
          shippedAt: row.shipment.shippedAt ? serializeDate(row.shipment.shippedAt) : null,
          expectedArrivalAt: row.shipment.expectedArrivalAt ? serializeDate(row.shipment.expectedArrivalAt) : null,
          receivedAt: row.shipment.receivedAt ? serializeDate(row.shipment.receivedAt) : null,
          outForDeliveryAt: row.shipment.outForDeliveryAt ? serializeDate(row.shipment.outForDeliveryAt) : null,
          deliveredAt: row.shipment.deliveredAt ? serializeDate(row.shipment.deliveredAt) : null,
          deliveryFailedAt: row.shipment.deliveryFailedAt ? serializeDate(row.shipment.deliveryFailedAt) : null,
          customerConfirmedReceiptAt: row.shipment.customerConfirmedReceiptAt
            ? serializeDate(row.shipment.customerConfirmedReceiptAt)
            : null,
        }
      : null,
    openIssue: row.openIssue
      ? {
          ...row.openIssue,
          createdAt: serializeDate(row.openIssue.createdAt),
          resolvedAt: row.openIssue.resolvedAt ? serializeDate(row.openIssue.resolvedAt) : null,
        }
      : null,
  };
}

export function toVendorFinanceOverviewDTO(overview: VendorFinanceOverview) {
  const { currency, ...amounts } = overview;
  return {
    currency,
    availableForSettlement: serializeMoney(amounts.availableForSettlement, currency),
    pending: serializeMoney(amounts.pending, currency),
    waitingPeriod: serializeMoney(amounts.waitingPeriod, currency),
    onHold: serializeMoney(amounts.onHold, currency),
    paidToDate: serializeMoney(amounts.paidToDate, currency),
    unappliedAdjustmentTotal: serializeMoney(amounts.unappliedAdjustmentTotal, currency),
  };
}

export function toVendorEarningSummaryDTO(row: VendorEarningSummaryView) {
  return {
    id: row.id,
    status: row.status,
    amount: serializeMoney(row.netAmount, row.currency),
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    createdAt: serializeDate(row.createdAt),
    eligibleAt: row.eligibleAt ? serializeDate(row.eligibleAt) : null,
    holdReasonSafe: row.holdReasonSafe,
  };
}

export function toVendorEarningDetailDTO(row: VendorEarningDetailView) {
  return {
    ...toVendorEarningSummaryDTO(row),
    fulfilmentId: row.fulfilmentId,
    fulfilmentStatus: row.fulfilmentStatus,
    orderItemDescription: row.orderItemDescription,
    quantity: row.quantity,
    adjustments: row.adjustments.map((a) => ({
      id: a.id,
      amount: serializeMoney(a.amount, row.currency),
      category: a.category,
      reason: a.reason,
      createdAt: serializeDate(a.createdAt),
    })),
  };
}

export function toVendorSettlementSummaryDTO(row: VendorSettlementSummaryView) {
  return {
    id: row.id,
    settlementNumber: row.settlementNumber,
    status: row.status,
    amount: serializeMoney(row.netAmount, row.currency),
    createdAt: serializeDate(row.createdAt),
    payoutPaidAt: row.payoutPaidAt ? serializeDate(row.payoutPaidAt) : null,
  };
}

export function toVendorSettlementDetailDTO(row: VendorSettlementDetailView) {
  return {
    ...toVendorSettlementSummaryDTO(row),
    grossPayable: serializeMoney(row.grossPayable, row.currency),
    adjustmentTotal: serializeMoney(row.adjustmentTotal, row.currency),
    approvedAt: row.approvedAt ? serializeDate(row.approvedAt) : null,
    payoutMethod: row.payoutMethod,
    payoutExternalReference: row.payoutExternalReference,
    payoutNote: row.payoutNote,
    payoutProvider: row.payoutProvider,
    reversedAt: row.reversedAt ? serializeDate(row.reversedAt) : null,
    reversalReason: row.reversalReason,
    destination: row.destination,
    items: row.items.map((item) => ({
      id: item.id,
      amount: serializeMoney(item.amount, row.currency),
      orderId: item.orderId,
      orderNumber: item.orderNumber,
    })),
    adjustments: row.adjustments.map((a) => ({
      id: a.id,
      amount: serializeMoney(a.amount, row.currency),
      category: a.category,
      reason: a.reason,
      createdAt: serializeDate(a.createdAt),
    })),
  };
}

export function toPayoutDestinationDTO(view: PayoutDestinationView) {
  if (!view) return null;
  return { ...view, updatedAt: serializeDate(view.updatedAt) };
}

export function toVendorBeautyProfileDTO(profile: VendorProfileView) {
  return {
    id: profile.id,
    status: profile.status,
    displayName: profile.displayName,
    bio: profile.bio,
    heroImage: profile.heroImage ? absoluteBeautyProfessionalImageUrl(profile.heroImage) : null,
    specialtyCategorySlugs: profile.specialtyCategorySlugs,
    locationMode: profile.locationMode,
    changesRequestedReason: profile.changesRequestedReason,
    createdAt: serializeDate(profile.createdAt),
    updatedAt: serializeDate(profile.updatedAt),
  };
}

export function toVendorServiceDTO(service: VendorServiceView) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    startingPrice: service.startingPrice ? serializeMoney(service.startingPrice, service.currency) : null,
    active: service.active,
    category: service.category,
    createdAt: serializeDate(service.createdAt),
    updatedAt: serializeDate(service.updatedAt),
  };
}

/** Never includes a private contact field — `customer`/`professional` are name-only (CrownSource remains the intermediary, M27 §16/§18). */
export function toVendorServiceRequestDTO(row: ServiceRequestView) {
  return {
    id: row.id,
    status: row.status,
    preferredDate: serializeDate(row.preferredDate),
    preferredTimeNote: row.preferredTimeNote,
    locationMode: row.locationMode,
    locationDetails: row.locationDetails,
    notes: row.notes,
    quantity: row.quantity,
    referenceImage: row.referenceImage ? absoluteServiceRequestImageUrl(row.referenceImage) : null,
    declineReason: row.declineReason,
    createdAt: serializeDate(row.createdAt),
    updatedAt: serializeDate(row.updatedAt),
    service: row.service,
    customer: row.customer,
  };
}

export function toVendorStoreProfileDTO(profile: VendorStoreProfile) {
  return {
    id: profile.id,
    companyName: profile.companyName,
    description: profile.description,
    storefrontSlug: profile.storefrontSlug,
    sellerType: profile.sellerType,
    // logoUrl is stored as a plain URL, not a storage key (see PublicVendorProfile's
    // own toVendorStorefrontDTO, which passes it through unchanged too) — never
    // wrap it in absoluteImageUrl().
    logoUrl: profile.logoUrl,
    country: profile.country,
    region: profile.region,
    city: profile.city,
    categorySlugs: profile.categorySlugs,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    leadTimeDaysDefault: profile.leadTimeDaysDefault,
    pickupAddressLine1: profile.pickupAddressLine1,
    pickupContactName: profile.pickupContactName,
    pickupContactPhone: profile.pickupContactPhone,
    pickupHours: profile.pickupHours,
    pickupNotes: profile.pickupNotes,
  };
}

/**
 * M25.2 — factory solicitation DTOs. Mirror the web vendor-portal views
 * exactly: request fields a factory legitimately needs (never customer
 * name/email — see modules/sourcing/types.ts's own doc comment on these
 * views), and the factory's own response once submitted.
 */
export function toVendorSolicitationSummaryDTO(row: VendorSolicitationSummaryView) {
  return {
    id: row.id,
    status: row.status,
    sentAt: serializeDate(row.sentAt),
    requestReference: row.requestReference,
    requestTitle: row.requestTitle,
    quantity: row.quantity,
    quantityUnit: row.quantityUnit,
  };
}

export function toVendorSolicitationDetailDTO(row: VendorSolicitationDetailView) {
  return {
    id: row.id,
    status: row.status,
    sentAt: serializeDate(row.sentAt),
    respondedAt: row.respondedAt ? serializeDate(row.respondedAt) : null,
    requestReference: row.requestReference,
    title: row.title,
    description: row.description,
    quantity: row.quantity,
    quantityUnit: row.quantityUnit,
    specifications: row.specifications,
    deliveryCountry: row.deliveryCountry,
    deliveryRegion: row.deliveryRegion,
    deliveryCity: row.deliveryCity,
    requiredByDate: row.requiredByDate ? serializeDate(row.requiredByDate) : null,
    attachments: row.attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      isImage: attachment.mimeType.startsWith("image/"),
      url: absoluteSourcingAttachmentUrl(attachment.id),
    })),
    response: row.response
      ? {
          proposedQuantity: row.response.proposedQuantity,
          unitPrice: row.response.unitPrice != null ? serializeMoney(row.response.unitPrice, row.response.currency) : null,
          leadTimeDays: row.response.leadTimeDays,
          notes: row.response.notes,
        }
      : null,
  };
}
