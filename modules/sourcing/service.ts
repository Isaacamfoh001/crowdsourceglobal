import { Prisma } from "../../generated/prisma/client";
import { generateSourcingRequestNumber } from "../../lib/sourcing-number";
import { storageProvider, generateStorageKey } from "../../lib/storage";
import { validateAttachment, sanitizeFilename, MAX_ATTACHMENTS_PER_REQUEST } from "../../lib/attachment-validation";
import { ok, err, type Result } from "../../lib/result";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { administrationRepository } from "../administration/repository";
import { messagingService } from "../messaging/service";
import { quotationService } from "../quotation/service";
import { catalogueService } from "../catalogue/service";
import { vendorsRepository } from "../vendors/repository";
import { sourcingRepository } from "./repository";
import type {
  AddSourcingOptionInput,
  AdminSourcingRequestDetailView,
  AdminSourcingRequestSummaryView,
  AdminSourcingSolicitationView,
  PrepareQuoteInput,
  QuotePricingSuggestion,
  RespondToSolicitationInput,
  SetAllocationsInput,
  SourcingRequestDetailView,
  SourcingRequestInput,
  SourcingRequestStatus,
  SourcingRequestSummaryView,
  StaffOption,
  VendorListingOption,
  VendorOption,
  VendorSolicitationDetailView,
  VendorSolicitationSummaryView,
} from "./types";

/**
 * M25.2 — CrownSource's markup over a factory's quoted unit price when
 * preparing the customer-facing commercial offer. A single exported
 * constant is the config point (CLAUDE.md's "avoid a DB config table
 * nobody touches" guidance, same reasoning as modules/notifications/
 * policy.ts's POLICY map) — change this one value to adjust the default
 * shown to admin; it is never enforced against what admin actually submits
 * to prepareAndIssueQuote, only pre-fills it.
 */
export const DEFAULT_SOURCING_MARKUP_PERCENT = 15;

/** Decimal-correct: `factoryUnitPrice * (1 + markupPercent / 100)`, rounded to 2dp — never floating-point multiplication on money. */
function applyMarkup(factoryUnitPrice: Prisma.Decimal, markupPercent: number): Prisma.Decimal {
  const multiplier = new Prisma.Decimal(1).plus(new Prisma.Decimal(markupPercent).dividedBy(100));
  return factoryUnitPrice.times(multiplier).toDecimalPlaces(2);
}

const STATUS_LABELS: Record<SourcingRequestStatus, string> = {
  SUBMITTED: "Request received",
  UNDER_REVIEW: "We're reviewing your request",
  SOURCING: "We're sourcing options",
  AWAITING_CUSTOMER: "We need information from you",
  QUOTED: "Your quotation is ready",
  ACCEPTED: "Quotation accepted",
  UNABLE_TO_SOURCE: "We couldn't source this request",
  CANCELLED: "Cancelled",
};

const CANCELLABLE_STATUSES: SourcingRequestStatus[] = ["SUBMITTED", "UNDER_REVIEW", "SOURCING", "AWAITING_CUSTOMER"];

const MAX_DERIVED_TITLE_LENGTH = 70;

/**
 * A photo-first submission (M24, mobile) may omit `title` entirely — the
 * web form's separate "title" field was never a business rule, just a
 * display label used in admin lists/activity/notification copy. When
 * absent, derive one from the description (first line, truncated) or fall
 * back to a generic photo-request label when there's no description at
 * all. Never invoked when the caller supplied a real title (web, unchanged).
 */
function deriveTitle(description: string, hasAttachment: boolean): string {
  const firstLine = description.split("\n")[0]?.trim() ?? "";
  if (firstLine) {
    return firstLine.length > MAX_DERIVED_TITLE_LENGTH ? `${firstLine.slice(0, MAX_DERIVED_TITLE_LENGTH - 1)}…` : firstLine;
  }
  return hasAttachment ? "Photo sourcing request" : "Sourcing request";
}

type RawAdminSourcingRow = {
  id: string;
  requestNumber: string;
  title: string;
  quantity: number;
  quantityUnit: string | null;
  status: SourcingRequestStatus;
  submittedAt: Date;
  updatedAt: Date;
  requiredByDate: Date | null;
  customerProfile: { displayName: string };
  assignedStaffId: string | null;
  assignedStaff: { user: { name: string } } | null;
  quotations: { id: string }[];
};

function toAdminSourcingSummary(row: RawAdminSourcingRow): AdminSourcingRequestSummaryView {
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    title: row.title,
    quantity: row.quantity,
    quantityUnit: row.quantityUnit,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
    requiredByDate: row.requiredByDate,
    customerName: row.customerProfile.displayName,
    assignedStaffId: row.assignedStaffId,
    assignedStaffName: row.assignedStaff?.user.name ?? null,
    hasQuotation: row.quotations.length > 0,
  };
}

async function notifyStaffOfNewRequest(requestId: string, requestNumber: string, title: string): Promise<void> {
  const admins = await administrationRepository.listAllForNotification();
  for (const admin of admins) {
    await notificationsService.notify({
      recipientUserId: admin.userId,
      type: "ADMIN_NEW_SOURCING_REQUEST",
      title: "New sourcing request",
      body: `New custom sourcing request ${requestNumber}: "${title}".`,
      targetUrl: notificationLinks.adminSourcing(requestId),
      eventKey: `admin-new-sourcing-request:${requestId}`,
      email: {
        to: admin.user.email,
        subject: "New sourcing request",
        templateKey: "admin-new-sourcing-request",
        templateData: { requestNumber, title, requestId },
      },
    });
  }
}

type RawAttachment = { id: string; filename: string; mimeType: string; sizeBytes: number; createdAt: Date };
type RawQuotationRef = { id: string; reference: string; status: string; total: Prisma.Decimal; currency: string; issuedAt: Date };

function toAttachmentView(row: RawAttachment) {
  return { id: row.id, filename: row.filename, mimeType: row.mimeType, sizeBytes: row.sizeBytes, createdAt: row.createdAt };
}

function toQuotationRef(row: RawQuotationRef) {
  return { id: row.id, reference: row.reference, status: row.status, total: row.total.toNumber(), currency: row.currency, issuedAt: row.issuedAt };
}

type RawAdminSolicitation = {
  id: string;
  vendorId: string;
  vendor: { companyName: string };
  status: "SENT" | "RESPONDED" | "CANNOT_FULFIL";
  sentAt: Date;
  respondedAt: Date | null;
  proposedQuantity: number | null;
  unitPrice: Prisma.Decimal | null;
  currency: string;
  leadTimeDays: number | null;
  notes: string | null;
  sourcingOption: { id: string } | null;
};

function toAdminSolicitationView(row: RawAdminSolicitation): AdminSourcingSolicitationView {
  return {
    id: row.id,
    vendorId: row.vendorId,
    vendorName: row.vendor.companyName,
    status: row.status,
    sentAt: row.sentAt,
    respondedAt: row.respondedAt,
    proposedQuantity: row.proposedQuantity,
    unitPrice: row.unitPrice?.toNumber() ?? null,
    currency: row.currency,
    leadTimeDays: row.leadTimeDays,
    notes: row.notes,
    convertedToOptionId: row.sourcingOption?.id ?? null,
  };
}

export const sourcingService = {
  // --- Customer ----------------------------------------------------------

  async submitRequest(
    customerProfileId: string,
    submittedByUserId: string,
    customerEmail: string,
    input: SourcingRequestInput,
    files: { buffer: Buffer; filename: string; mimeType: string }[],
  ): Promise<Result<{ id: string; requestNumber: string }>> {
    // Photo-first rule (M24): a title is optional (derived below when
    // absent) and description is required only when no reference image was
    // supplied — a photo alone is a complete, valid request.
    if (!input.description.trim() && files.length === 0) {
      return err("Add a photo or describe what you need.");
    }
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) return err("Enter a valid quantity.");
    if (!input.deliveryCountry.trim()) return err("Enter a delivery destination.");
    if (files.length > MAX_ATTACHMENTS_PER_REQUEST) {
      return err(`You can attach up to ${MAX_ATTACHMENTS_PER_REQUEST} files.`);
    }
    for (const file of files) {
      const validation = validateAttachment({ mimeType: file.mimeType, sizeBytes: file.buffer.length, buffer: file.buffer });
      if (!validation.ok) return err(validation.error);
    }

    const uploaded: { storageKey: string; filename: string; mimeType: string; sizeBytes: number }[] = [];
    try {
      for (const file of files) {
        const storageKey = generateStorageKey();
        await storageProvider.putObject({ key: storageKey, buffer: file.buffer, contentType: file.mimeType });
        uploaded.push({
          storageKey,
          filename: sanitizeFilename(file.filename),
          mimeType: file.mimeType,
          sizeBytes: file.buffer.length,
        });
      }
    } catch (error) {
      console.error("Sourcing attachment upload failed:", error);
      return err("Something went wrong uploading your attachment. Please try again.");
    }

    const resolvedTitle = input.title?.trim() || deriveTitle(input.description.trim(), files.length > 0);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const requestNumber = generateSourcingRequestNumber();
      try {
        const created = await sourcingRepository.createRequestTransactional(
          customerProfileId,
          requestNumber,
          {
            title: resolvedTitle,
            description: input.description.trim(),
            quantity: input.quantity,
            quantityUnit: input.quantityUnit || null,
            specifications: input.specifications as Prisma.InputJsonValue | undefined,
            requiredByDate: input.requiredByDate ?? null,
            deliveryCountry: input.deliveryCountry.trim(),
            deliveryRegion: input.deliveryRegion || null,
            deliveryCity: input.deliveryCity || null,
            budgetAmount: input.budgetAmount ?? null,
            budgetCurrency: input.budgetCurrency || null,
            categoryId: input.categoryId || null,
          },
          uploaded,
          submittedByUserId,
        );

        await notificationsService.notify({
          recipientUserId: submittedByUserId,
          type: "SOURCING_REQUEST_SUBMITTED",
          title: "Request received",
          body: `We've received your sourcing request ${created.requestNumber}.`,
          targetUrl: notificationLinks.customerSourcing(created.id),
          eventKey: `sourcing-request-submitted:${created.id}`,
          email: {
            to: customerEmail,
            subject: "We've received your sourcing request",
            templateKey: "sourcing-request-submitted",
            templateData: { requestNumber: created.requestNumber, requestId: created.id },
          },
        });
        await notifyStaffOfNewRequest(created.id, created.requestNumber, resolvedTitle);

        return ok({ id: created.id, requestNumber: created.requestNumber });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 2) {
          continue; // requestNumber collision — retry with a freshly generated one
        }
        console.error("Sourcing request submission failed unexpectedly:", error);
        return err("Something went wrong submitting your request. Please try again.");
      }
    }

    return err("Something went wrong submitting your request. Please try again.");
  },

  async listForCustomer(customerProfileId: string, page = 1): Promise<{ rows: SourcingRequestSummaryView[]; total: number; pageSize: number }> {
    const { rows, total } = await sourcingRepository.findSummariesForCustomer(customerProfileId, page, DEFAULT_PAGE_SIZE);
    return {
      rows: rows.map((row) => ({
        id: row.id,
        requestNumber: row.requestNumber,
        title: row.title,
        quantity: row.quantity,
        quantityUnit: row.quantityUnit,
        status: row.status,
        statusLabel: STATUS_LABELS[row.status],
        submittedAt: row.submittedAt,
        hasQuotation: row.quotations.length > 0,
        primaryAttachment: row.attachments[0] ? { id: row.attachments[0].id, mimeType: row.attachments[0].mimeType } : null,
      })),
      total,
      pageSize: DEFAULT_PAGE_SIZE,
    };
  },

  async getDetailForCustomer(id: string, customerProfileId: string): Promise<SourcingRequestDetailView | null> {
    const row = await sourcingRepository.findDetailForCustomer(id, customerProfileId);
    if (!row) return null;
    return {
      id: row.id,
      requestNumber: row.requestNumber,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      title: row.title,
      description: row.description,
      quantity: row.quantity,
      quantityUnit: row.quantityUnit,
      specifications: row.specifications as Record<string, string> | null,
      requiredByDate: row.requiredByDate,
      deliveryCountry: row.deliveryCountry,
      deliveryRegion: row.deliveryRegion,
      deliveryCity: row.deliveryCity,
      budgetAmount: row.budgetAmount?.toNumber() ?? null,
      budgetCurrency: row.budgetCurrency,
      unableToSourceReason: row.unableToSourceReason,
      submittedAt: row.submittedAt,
      attachments: row.attachments.map(toAttachmentView),
      latestQuotation: row.quotations[0] ? toQuotationRef(row.quotations[0]) : null,
    };
  },

  async cancelRequest(id: string, customerProfileId: string): Promise<Result<null>> {
    const request = await sourcingRepository.findForCancellation(id, customerProfileId);
    if (!request) return err("Request not found.");
    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      return err("This request can no longer be cancelled.");
    }
    const applied = await sourcingRepository.cancel(id, CANCELLABLE_STATUSES);
    if (!applied) return err("This request can no longer be cancelled.");
    await sourcingRepository.createActivity(id, "cancelled", null);
    return ok(null);
  },

  /**
   * Attachment access is authorization-checked HERE (not in the route
   * handler) so both the customer-portal and admin download paths share
   * one rule: the request's owning customer, or any authenticated staff
   * member — never another customer, never a Vendor.
   */
  async getAttachmentForDownload(
    attachmentId: string,
    accessor: { customerProfileId?: string; isStaff: boolean; vendorId?: string },
  ): Promise<{ storageKey: string; filename: string; mimeType: string } | null> {
    const attachment = await sourcingRepository.findAttachmentForAccess(attachmentId);
    if (!attachment) return null;
    const owns = accessor.customerProfileId === attachment.sourcingRequest.customerProfileId;
    // M25.2 — a factory may view a customer's reference images only for a
    // request it was actually sent (a real SourcingSolicitation row exists
    // for its own vendorId) — never for any other request, never for
    // another factory's solicitation.
    const isSolicitedFactory =
      !!accessor.vendorId && attachment.sourcingRequest.solicitations.some((s) => s.vendorId === accessor.vendorId);
    if (!owns && !accessor.isStaff && !isSolicitedFactory) return null;
    return { storageKey: attachment.storageKey, filename: attachment.filename, mimeType: attachment.mimeType };
  },

  // --- Admin/staff ---------------------------------------------------------

  async listForAdmin(filter: { status?: SourcingRequestStatus; assignedStaffId?: string }): Promise<AdminSourcingRequestSummaryView[]> {
    const rows = await sourcingRepository.listForAdmin(filter);
    return rows.map(toAdminSourcingSummary);
  },

  /** (M11.1) Paginated variant for the admin sourcing requests queue page — see listForAdminPaginated on the repository. */
  async listForAdminPaginated(
    filter: { status?: SourcingRequestStatus; assignedStaffId?: string },
    page: number,
  ): Promise<{ rows: AdminSourcingRequestSummaryView[]; total: number; pageSize: number }> {
    const { rows, total } = await sourcingRepository.listForAdminPaginated(filter, page, DEFAULT_PAGE_SIZE);
    return { rows: rows.map(toAdminSourcingSummary), total, pageSize: DEFAULT_PAGE_SIZE };
  },

  async listStaffOptions(): Promise<StaffOption[]> {
    const staff = await administrationRepository.listAll();
    return staff.map((s) => ({ id: s.id, name: `${s.user.name} (${s.role})` }));
  },

  async listVendorOptions(): Promise<VendorOption[]> {
    return sourcingRepository.listApprovedVendorsForPicker();
  },

  /**
   * Reuses the public catalogue read path — no new listing query needed.
   * (M11.1) Uses the bounded/uncapped read, not the paginated one: this is
   * an admin picker dropdown, not a page a user pages through. 48
   * preserves the effective cap catalogueRepository.listListings used to
   * hard-code before pagination was added.
   */
  async listVendorListingOptions(): Promise<VendorListingOption[]> {
    const listings = await catalogueService.listListingsCapped({}, 48);
    return listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      vendorId: listing.vendor.id,
      vendorName: listing.vendor.companyName,
    }));
  },

  async getDetailForAdmin(id: string): Promise<AdminSourcingRequestDetailView | null> {
    const row = await sourcingRepository.findDetailForAdmin(id);
    if (!row) return null;

    const allocatedByOption = new Map<string, number>();
    for (const allocation of row.allocations) {
      allocatedByOption.set(allocation.sourcingOptionId, (allocatedByOption.get(allocation.sourcingOptionId) ?? 0) + allocation.allocatedQuantity);
    }

    return {
      id: row.id,
      requestNumber: row.requestNumber,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      title: row.title,
      description: row.description,
      quantity: row.quantity,
      quantityUnit: row.quantityUnit,
      specifications: row.specifications as Record<string, string> | null,
      requiredByDate: row.requiredByDate,
      deliveryCountry: row.deliveryCountry,
      deliveryRegion: row.deliveryRegion,
      deliveryCity: row.deliveryCity,
      budgetAmount: row.budgetAmount?.toNumber() ?? null,
      budgetCurrency: row.budgetCurrency,
      unableToSourceReason: row.unableToSourceReason,
      submittedAt: row.submittedAt,
      attachments: row.attachments.map(toAttachmentView),
      customerName: row.customerProfile.displayName,
      customerEmail: row.customerProfile.user.email,
      assignedStaffId: row.assignedStaffId,
      assignedStaffName: row.assignedStaff?.user.name ?? null,
      solicitations: row.solicitations.map(toAdminSolicitationView),
      options: row.options.map((option) => ({
        id: option.id,
        sourceType: option.sourceType,
        vendorId: option.vendorId,
        vendorName: option.vendor?.companyName ?? null,
        vendorListingId: option.vendorListingId,
        vendorListingTitle: option.vendorListing?.title ?? null,
        externalSupplierName: option.externalSupplierName,
        externalSupplierContact: option.externalSupplierContact,
        quantityAvailable: option.quantityAvailable,
        proposedQuantity: option.proposedQuantity,
        unitSupplyCost: option.unitSupplyCost.toNumber(),
        currency: option.currency,
        leadTimeDays: option.leadTimeDays,
        originCountry: option.originCountry,
        notes: option.notes,
        allocatedQuantity: allocatedByOption.get(option.id) ?? 0,
      })),
      allocations: row.allocations.map((allocation) => ({
        id: allocation.id,
        sourcingOptionId: allocation.sourcingOptionId,
        optionLabel:
          allocation.sourcingOption.vendor?.companyName ?? allocation.sourcingOption.externalSupplierName ?? "Sourcing option",
        allocatedQuantity: allocation.allocatedQuantity,
        unitSupplyCostSnapshot: allocation.unitSupplyCostSnapshot.toNumber(),
        currency: allocation.currency,
        leadTimeDaysSnapshot: allocation.leadTimeDaysSnapshot,
        originCountrySnapshot: allocation.originCountrySnapshot,
      })),
      allocatedTotal: row.allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0),
      quotations: row.quotations.map(toQuotationRef),
      activities: row.activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        createdAt: activity.createdAt,
        actorName: null, // resolving actorUserId -> display name isn't needed for M6's staff-only activity feed
        metadata: activity.metadata as Record<string, unknown> | null,
      })),
    };
  },

  async assignStaff(id: string, staffId: string | null): Promise<Result<null>> {
    await sourcingRepository.assignStaff(id, staffId);
    await sourcingRepository.createActivity(id, "assigned", null, { staffId });
    return ok(null);
  },

  async moveToUnderReview(id: string): Promise<Result<null>> {
    const applied = await sourcingRepository.updateStatus(id, ["SUBMITTED"], "UNDER_REVIEW");
    if (!applied) return err("This request isn't awaiting initial review.");
    await sourcingRepository.createActivity(id, "review_started", null);
    return ok(null);
  },

  async moveToSourcing(id: string): Promise<Result<null>> {
    const applied = await sourcingRepository.updateStatus(id, ["UNDER_REVIEW", "AWAITING_CUSTOMER"], "SOURCING");
    if (!applied) return err("This request isn't ready to move into sourcing.");
    await sourcingRepository.createActivity(id, "sourcing_started", null);
    return ok(null);
  },

  /** Sends a staff message on the sourcing conversation AND moves the request to AWAITING_CUSTOMER, atomically in intent if not in a single DB transaction (status guard prevents a stale double-fire). */
  async requestClarification(id: string, staffUserId: string, message: string): Promise<Result<null>> {
    if (!message.trim()) return err("Write a message before sending.");
    const context = await sourcingRepository.findOwnerEmailAndNumber(id);
    if (!context) return err("Request not found.");

    const applied = await sourcingRepository.updateStatus(id, ["SOURCING"], "AWAITING_CUSTOMER");
    if (!applied) return err("This request isn't currently in sourcing.");

    const messageResult = await messagingService.staffStartOrContinueContextual({
      customerProfileId: context.customerProfileId,
      staffUserId,
      contextType: "SOURCING_REQUEST",
      contextRefId: id,
      body: message,
    });
    if (!messageResult.ok) return messageResult;

    await sourcingRepository.createActivity(id, "clarification_requested", staffUserId);
    await notificationsService.notify({
      recipientUserId: context.customerProfile.userId,
      type: "SOURCING_CLARIFICATION_NEEDED",
      title: "We need more information from you",
      body: `CrownSourceGlobal needs more information about your sourcing request ${context.requestNumber}.`,
      targetUrl: notificationLinks.customerSourcing(id),
      eventKey: `sourcing-clarification-needed:${id}:${Date.now()}`,
      email: {
        to: context.customerProfile.user.email,
        subject: "We need more information from you",
        templateKey: "sourcing-clarification-needed",
        templateData: { requestNumber: context.requestNumber, requestId: id },
      },
    });
    return ok(null);
  },

  async addOption(id: string, input: AddSourcingOptionInput): Promise<Result<null>> {
    if (input.sourceType === "VENDOR" && !input.vendorId) return err("Select a vendor.");
    if (input.sourceType === "VENDOR_LISTING" && (!input.vendorId || !input.vendorListingId)) {
      return err("Select a listing.");
    }
    if (input.sourceType === "EXTERNAL_SUPPLIER" && !input.externalSupplierName?.trim()) {
      return err("Enter the external supplier's name.");
    }
    if (!Number.isInteger(input.proposedQuantity) || input.proposedQuantity <= 0) {
      return err("Enter a valid proposed quantity.");
    }
    if (!(input.unitSupplyCost > 0)) return err("Enter a supply cost greater than zero.");

    await sourcingRepository.addOption(id, {
      sourceType: input.sourceType,
      vendorId: input.vendorId || null,
      vendorListingId: input.vendorListingId || null,
      externalSupplierName: input.externalSupplierName?.trim() || null,
      externalSupplierContact: input.externalSupplierContact?.trim() || null,
      quantityAvailable: input.quantityAvailable ?? null,
      proposedQuantity: input.proposedQuantity,
      unitSupplyCost: input.unitSupplyCost,
      currency: input.currency ?? "GHS",
      leadTimeDays: input.leadTimeDays ?? null,
      originCountry: input.originCountry?.trim() || null,
      notes: input.notes?.trim() || null,
    });
    await sourcingRepository.createActivity(id, "option_added", null);
    return ok(null);
  },

  async removeOption(id: string, optionId: string): Promise<Result<null>> {
    const result = await sourcingRepository.removeOption(optionId, id);
    if (result.count === 0) return err("Option not found.");
    return ok(null);
  },

  /**
   * Incremental save — does NOT require the sum to equal the request
   * quantity yet (staff may be mid-planning). The hard "sum must equal the
   * full request quantity" gate is enforced only at prepareAndIssueQuote,
   * per the M6 brief's "prefer full-request quotation" instruction.
   */
  async setAllocations(id: string, allocations: SetAllocationsInput): Promise<Result<null>> {
    const options = await sourcingRepository.findOptionsForRequest(id);
    const optionById = new Map(options.map((o) => [o.id, o]));

    for (const allocation of allocations) {
      if (!optionById.has(allocation.sourcingOptionId)) {
        return err("One of the selected sourcing options doesn't belong to this request.");
      }
      if (!Number.isInteger(allocation.allocatedQuantity) || allocation.allocatedQuantity <= 0) {
        return err("Enter a valid allocated quantity.");
      }
    }

    const snapshots = allocations.map((allocation) => {
      const option = optionById.get(allocation.sourcingOptionId)!;
      return {
        sourcingOptionId: allocation.sourcingOptionId,
        allocatedQuantity: allocation.allocatedQuantity,
        unitSupplyCostSnapshot: option.unitSupplyCost.toNumber(),
        currency: option.currency,
        leadTimeDaysSnapshot: option.leadTimeDays,
        originCountrySnapshot: option.originCountry,
      };
    });

    await sourcingRepository.replaceAllocations(id, snapshots);
    await sourcingRepository.createActivity(id, "allocation_selected", null);
    return ok(null);
  },

  /**
   * The commercial-offer step. Validates that the current allocations
   * exactly cover the request's quantity (M6 §26/§27 — never silently
   * produce a full-quantity quote from a partial allocation), computes the
   * internal cost basis, derives whether a single marketplace Vendor can be
   * attributed internally (drives automatic Fulfilment creation later —
   * see modules/orders/service.ts), and issues (or reissues/supersedes) the
   * Quotation via the shared M5 Quotation architecture.
   */
  async prepareAndIssueQuote(id: string, input: PrepareQuoteInput): Promise<Result<{ quotationId: string; reference: string }>> {
    if (!input.description.trim()) return err("Enter a commercial description for the customer.");
    if (!(input.unitPrice > 0)) return err("Enter a unit price greater than zero.");

    const request = await sourcingRepository.findStatusForUpdate(id);
    if (!request) return err("Request not found.");
    if (request.status !== "SOURCING" && request.status !== "QUOTED") {
      return err("This request isn't ready to be quoted.");
    }

    const detail = await sourcingRepository.findDetailForAdmin(id);
    if (!detail) return err("Request not found.");

    const allocatedTotal = detail.allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
    if (allocatedTotal !== request.quantity) {
      return err(
        `Allocated quantity (${allocatedTotal}) must equal the requested quantity (${request.quantity}) before issuing a quote.`,
      );
    }
    if (detail.allocations.length === 0) return err("Add at least one supplier allocation before issuing a quote.");

    const otherInternalCosts = input.otherInternalCosts ?? 0;
    const allocationCost = detail.allocations.reduce((sum, a) => sum + a.allocatedQuantity * a.unitSupplyCostSnapshot.toNumber(), 0);
    const vendorPayableBasis = allocationCost + otherInternalCosts;

    // Single-vendor derivation: only when every allocation traces to the
    // SAME marketplace Vendor (never for any EXTERNAL_SUPPLIER involvement,
    // and never for a genuinely mixed multi-vendor allocation) — this is
    // what lets the existing, unmodified confirmOrderPayment auto-create a
    // Fulfilment later. Anything else stays null; operations manages that
    // leg manually via this same allocation view.
    const optionById = new Map(detail.options.map((o) => [o.id, o]));
    const vendorIds = new Set(
      detail.allocations.map((a) => optionById.get(a.sourcingOptionId)?.vendorId ?? null),
    );
    const singleVendorId = vendorIds.size === 1 ? ([...vendorIds][0] ?? null) : null;
    const isReissue = request.status === "QUOTED";

    // Issue the Quotation FIRST — only flip the request to QUOTED once a
    // real Quotation row exists, so a failure here never leaves the
    // request stuck at QUOTED with nothing to show for it.
    const result = await quotationService.issueCustomSourcingQuote({
      customerProfileId: detail.customerProfileId,
      sourcingRequestId: id,
      description: input.description.trim(),
      quantity: request.quantity,
      unitPrice: input.unitPrice,
      vendorPayableBasis,
      vendorId: singleVendorId,
    });
    if (!result.ok) return result;

    await sourcingRepository.updateStatus(id, ["SOURCING", "QUOTED"], "QUOTED", { quotedAt: new Date() });
    await sourcingRepository.createActivity(id, isReissue ? "quote_superseded" : "quote_issued", null, {
      quotationId: result.value.quotationId,
      reference: result.value.reference,
    });

    const context = await sourcingRepository.findOwnerEmailAndNumber(id);
    if (context) {
      await notificationsService.notify({
        recipientUserId: context.customerProfile.userId,
        type: "SOURCING_QUOTE_READY",
        title: "Your sourcing quotation is ready",
        body: `Your quotation for sourcing request ${context.requestNumber} is ready: ${result.value.reference}.`,
        targetUrl: notificationLinks.customerSourcing(id),
        eventKey: `sourcing-quote-ready:${result.value.quotationId}`,
        email: {
          to: context.customerProfile.user.email,
          subject: "Your sourcing quotation is ready",
          templateKey: "sourcing-quote-ready",
          templateData: { requestNumber: context.requestNumber, reference: result.value.reference, requestId: id },
        },
      });
    }

    return result;
  },

  async markUnableToSource(id: string, customerSafeReason: string): Promise<Result<null>> {
    if (!customerSafeReason.trim()) return err("Enter an explanation for the customer.");
    const applied = await sourcingRepository.updateStatus(id, ["UNDER_REVIEW", "SOURCING", "AWAITING_CUSTOMER"], "UNABLE_TO_SOURCE", {
      unableToSourceReason: customerSafeReason.trim(),
      closedAt: new Date(),
    });
    if (!applied) return err("This request can't be marked unable to source from its current state.");
    await sourcingRepository.createActivity(id, "unable_to_source", null);

    const context = await sourcingRepository.findOwnerEmailAndNumber(id);
    if (context) {
      await notificationsService.notify({
        recipientUserId: context.customerProfile.userId,
        type: "SOURCING_UNABLE_TO_SOURCE",
        title: "We couldn't source this request",
        body: `We're unable to source your request ${context.requestNumber}: ${customerSafeReason.trim()}`,
        targetUrl: notificationLinks.customerSourcing(id),
        eventKey: `sourcing-unable-to-source:${id}`,
        email: {
          to: context.customerProfile.user.email,
          subject: "We couldn't source this request",
          templateKey: "sourcing-unable-to-source",
          templateData: { requestNumber: context.requestNumber, reason: customerSafeReason.trim(), requestId: id },
        },
      });
    }
    return ok(null);
  },

  // --- Factory solicitation (M25.2) ---------------------------------------

  /**
   * "Ask factories" — sends the SAME sourcing request to one or more
   * approved vendors, unmodified (no manual re-entry). Idempotent: a
   * vendor already asked for this request is silently skipped at the DB
   * layer (the (sourcingRequestId, vendorId) unique constraint), and
   * re-notifying an already-asked vendor is a safe no-op too (per-vendor
   * eventKey below is stable, so notificationsService.notify()'s own
   * dedup guarantee absorbs a repeat "ask factories" click that includes
   * them again).
   */
  async sendToFactories(id: string, vendorIds: string[], staffUserId: string): Promise<Result<null>> {
    const uniqueVendorIds = [...new Set(vendorIds)];
    if (uniqueVendorIds.length === 0) return err("Select at least one factory.");

    const request = await sourcingRepository.findStatusForUpdate(id);
    if (!request) return err("Request not found.");
    if (request.status !== "SOURCING") return err("Send this request to factories only while it's in sourcing.");

    await sourcingRepository.createSolicitations(id, uniqueVendorIds);
    await sourcingRepository.createActivity(id, "sent_to_factories", staffUserId, { vendorIds: uniqueVendorIds });

    const summary = await sourcingRepository.findRequestSummaryForNotification(id);
    const solicitations = await sourcingRepository.findSolicitationsByRequestAndVendors(id, uniqueVendorIds);
    for (const solicitation of solicitations) {
      const owner = await vendorsRepository.findOwnerUserIdAndEmail(solicitation.vendorId);
      if (!owner) continue;
      await notificationsService.notify({
        recipientUserId: owner.userId,
        type: "VENDOR_SOURCING_SOLICITATION_RECEIVED",
        title: "New sourcing request from CrownSourceGlobal",
        body: `CrownSourceGlobal is asking whether you can fulfil a sourcing request for ${summary?.quantity ?? "?"} ${summary?.quantityUnit ?? "units"}.`,
        targetUrl: notificationLinks.vendorSourcingSolicitation(solicitation.id),
        eventKey: `sourcing-solicitation-sent:${solicitation.id}`,
        email: {
          to: owner.email,
          subject: "New sourcing request from CrownSourceGlobal",
          templateKey: "vendor-sourcing-solicitation-received",
          templateData: { quantity: summary?.quantity ?? "", quantityUnit: summary?.quantityUnit, solicitationId: solicitation.id },
        },
      });
    }
    return ok(null);
  },

  /**
   * Admin selects a factory response and converts it into a SourcingOption
   * — auto-populated from the response (proposed quantity, unit price,
   * lead time, notes), never re-typed by admin. Idempotent: a repeat click
   * returns the SAME option (sourcingSolicitationId is unique) rather than
   * creating a duplicate, including under a race between two clicks.
   */
  async useSolicitationForOption(id: string, solicitationId: string): Promise<Result<{ optionId: string }>> {
    const solicitation = await sourcingRepository.findSolicitationById(solicitationId);
    if (!solicitation || solicitation.sourcingRequestId !== id) return err("Response not found.");
    if (solicitation.sourcingOption) return ok({ optionId: solicitation.sourcingOption.id });
    if (solicitation.status !== "RESPONDED") return err("This factory hasn't submitted a usable response yet.");
    if (solicitation.proposedQuantity == null || solicitation.unitPrice == null) {
      return err("This response is missing required figures.");
    }

    try {
      const option = await sourcingRepository.createOptionFromSolicitation({
        sourcingRequestId: id,
        sourcingSolicitationId: solicitation.id,
        vendorId: solicitation.vendorId,
        proposedQuantity: solicitation.proposedQuantity,
        unitSupplyCost: solicitation.unitPrice.toNumber(),
        currency: solicitation.currency,
        leadTimeDays: solicitation.leadTimeDays,
        notes: solicitation.notes,
      });
      await sourcingRepository.createActivity(id, "factory_response_used_for_option", null, { solicitationId, optionId: option.id });
      return ok({ optionId: option.id });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await sourcingRepository.findOptionBySolicitationId(solicitation.id);
        if (existing) return ok({ optionId: existing.id });
      }
      console.error("Failed to convert factory response into a sourcing option:", error);
      return err("Something went wrong using this response. Please try again.");
    }
  },

  /**
   * Server-authoritative pricing suggestion for the "Prepare quote" form —
   * NEVER trusted if a client echoed these numbers back; prepareAndIssueQuote
   * still independently validates whatever admin actually submits. Uses
   * Prisma.Decimal throughout (never floating-point) for the markup math.
   */
  async getQuotePricingSuggestion(optionId: string, markupPercent: number = DEFAULT_SOURCING_MARKUP_PERCENT): Promise<QuotePricingSuggestion | null> {
    const option = await sourcingRepository.findOptionForPricing(optionId);
    if (!option) return null;
    const customerUnitPrice = applyMarkup(option.unitSupplyCost, markupPercent);
    const factorySubtotal = option.unitSupplyCost.times(option.proposedQuantity);
    const customerSubtotal = customerUnitPrice.times(option.proposedQuantity);
    return {
      factoryUnitPrice: option.unitSupplyCost.toNumber(),
      factoryQuantity: option.proposedQuantity,
      factorySubtotal: factorySubtotal.toNumber(),
      markupPercent,
      customerUnitPrice: customerUnitPrice.toNumber(),
      customerSubtotal: customerSubtotal.toNumber(),
      currency: option.currency,
    };
  },

  // --- Factory (vendor) portal ---------------------------------------------

  async listSolicitationsForVendor(
    vendorId: string,
    page = 1,
  ): Promise<{ rows: VendorSolicitationSummaryView[]; total: number; pageSize: number }> {
    const [rows, total] = await sourcingRepository.listSolicitationsForVendor(vendorId, page, DEFAULT_PAGE_SIZE);
    return {
      rows: rows.map((row) => ({
        id: row.id,
        status: row.status,
        sentAt: row.sentAt,
        requestReference: row.sourcingRequest.requestNumber,
        requestTitle: row.sourcingRequest.title,
        quantity: row.sourcingRequest.quantity,
        quantityUnit: row.sourcingRequest.quantityUnit,
      })),
      total,
      pageSize: DEFAULT_PAGE_SIZE,
    };
  },

  /**
   * Ownership-scoped (vendorId resolved server-side from the caller's own
   * vendor membership — never trusted from the client) and privacy-scoped:
   * only the request fields a factory legitimately needs. Never includes
   * customerName/customerEmail/other factories' identities or responses.
   */
  async getSolicitationDetailForVendor(id: string, vendorId: string): Promise<VendorSolicitationDetailView | null> {
    const row = await sourcingRepository.findSolicitationForVendor(id, vendorId);
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      sentAt: row.sentAt,
      respondedAt: row.respondedAt,
      requestReference: row.sourcingRequest.requestNumber,
      title: row.sourcingRequest.title,
      description: row.sourcingRequest.description,
      quantity: row.sourcingRequest.quantity,
      quantityUnit: row.sourcingRequest.quantityUnit,
      specifications: row.sourcingRequest.specifications as Record<string, string> | null,
      deliveryCountry: row.sourcingRequest.deliveryCountry,
      deliveryRegion: row.sourcingRequest.deliveryRegion,
      deliveryCity: row.sourcingRequest.deliveryCity,
      requiredByDate: row.sourcingRequest.requiredByDate,
      attachments: row.sourcingRequest.attachments.map(toAttachmentView),
      response:
        row.status === "SENT"
          ? null
          : {
              proposedQuantity: row.proposedQuantity,
              unitPrice: row.unitPrice?.toNumber() ?? null,
              currency: row.currency,
              leadTimeDays: row.leadTimeDays,
              notes: row.notes,
            },
    };
  },

  /** Ownership + state guard enforced atomically in the repository update — a factory can only ever respond once, to its own solicitation. */
  async respondToSolicitation(id: string, vendorId: string, input: RespondToSolicitationInput): Promise<Result<null>> {
    if (input.canFulfil) {
      if (!Number.isInteger(input.proposedQuantity) || input.proposedQuantity <= 0) {
        return err("Enter a valid quantity.");
      }
      if (!(input.unitPrice > 0)) return err("Enter a unit price greater than zero.");
      const result = await sourcingRepository.respondToSolicitation(id, vendorId, {
        status: "RESPONDED",
        respondedAt: new Date(),
        proposedQuantity: input.proposedQuantity,
        unitPrice: input.unitPrice,
        leadTimeDays: input.leadTimeDays ?? null,
        notes: input.notes?.trim() || null,
      });
      if (result.count === 0) return err("This request is no longer awaiting your response.");
    } else {
      const result = await sourcingRepository.respondToSolicitation(id, vendorId, { status: "CANNOT_FULFIL", respondedAt: new Date() });
      if (result.count === 0) return err("This request is no longer awaiting your response.");
    }

    const solicitation = await sourcingRepository.findSolicitationById(id);
    if (solicitation) {
      const summary = await sourcingRepository.findRequestSummaryForNotification(solicitation.sourcingRequestId);
      const recipients = summary?.assignedStaff
        ? [{ userId: summary.assignedStaff.user.id, email: summary.assignedStaff.user.email }]
        : (await administrationRepository.listAllForNotification()).map((a) => ({ userId: a.userId, email: a.user.email }));
      for (const recipient of recipients) {
        await notificationsService.notify({
          recipientUserId: recipient.userId,
          type: "ADMIN_SOURCING_SOLICITATION_RESPONDED",
          title: "A factory responded to your sourcing request",
          body: `${solicitation.vendor.companyName} responded to sourcing request ${summary?.requestNumber ?? ""}.`,
          targetUrl: notificationLinks.adminSourcing(solicitation.sourcingRequestId),
          eventKey: `sourcing-solicitation-responded:${id}`,
          email: {
            to: recipient.email,
            subject: "A factory responded to your sourcing request",
            templateKey: "admin-sourcing-solicitation-responded",
            templateData: {
              vendorName: solicitation.vendor.companyName,
              requestNumber: summary?.requestNumber ?? "",
              requestId: solicitation.sourcingRequestId,
            },
          },
        });
      }
    }
    return ok(null);
  },
};
