import { Prisma } from "../../generated/prisma/client";
import { pricingService } from "../pricing/service";
import { resolveUnitPrice } from "../pricing/resolveUnitPrice";
import { generateQuoteReference } from "../../lib/quote-number";
import { env } from "../../lib/env";
import { ok, err, type Result } from "../../lib/result";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { quotationRepository } from "./repository";
import type {
  AdminQuotationDetailView,
  AdminQuotationSummaryView,
  QuotationDetailView,
  QuotationEffectiveStatus,
  QuotationSummaryView,
  QuoteDraftLine,
  QuoteDraftLineView,
} from "./types";

const MAX_DRAFT_LINES = 20;

function deriveEffectiveStatus(status: string, expiresAt: Date): QuotationEffectiveStatus {
  if (status === "ISSUED" && expiresAt.getTime() < Date.now()) {
    return "EXPIRED";
  }
  return status as QuotationEffectiveStatus;
}

/** Merges duplicate listingIds (defensive — the draft cookie is already upserted per-listing). */
function dedupeDraftLines(lines: QuoteDraftLine[]): QuoteDraftLine[] {
  const byListing = new Map<string, number>();
  for (const line of lines) {
    byListing.set(line.listingId, (byListing.get(line.listingId) ?? 0) + line.quantity);
  }
  return [...byListing.entries()].map(([listingId, quantity]) => ({ listingId, quantity }));
}

export const quotationService = {
  /** Cosmetic preview for the Quote Builder — never the pricing source of truth at issuance. */
  async getDraftPreview(draftLines: QuoteDraftLine[]): Promise<QuoteDraftLineView[]> {
    if (draftLines.length === 0) return [];

    const listingIds = draftLines.map((line) => line.listingId);
    const listings = await quotationRepository.findListingsForDraft(listingIds);
    const listingById = new Map(listings.map((listing) => [listing.id, listing]));
    const tiersByListing = await pricingService.getBulkTiersForListings(listingIds);

    return draftLines
      .map((line) => {
        const listing = listingById.get(line.listingId);
        if (!listing) return null;

        const tiers = tiersByListing.get(line.listingId) ?? [];
        const unitPrice = resolveUnitPrice(listing.basePrice.toNumber(), tiers, line.quantity);
        const stillEligible = listing.approvalStatus === "APPROVED" && listing.listingStatus === "ACTIVE";

        const view: QuoteDraftLineView = {
          listingId: listing.id,
          title: listing.title,
          vendor: listing.vendor,
          quantity: line.quantity,
          moq: listing.moq,
          maxOq: listing.maxOq,
          unitPrice,
          lineTotal: unitPrice * line.quantity,
          currency: listing.currency,
          stillEligible,
        };
        return view;
      })
      .filter((view): view is QuoteDraftLineView => view !== null);
  },

  /**
   * Server-side authoritative issuance. Re-validates every line fresh
   * (approval/active/MOQ/maxOq) and recomputes pricing from live
   * BulkPriceTier/VendorCostRule — nothing about the draft/preview is
   * trusted. Does NOT reserve inventory (see docs/workflows/workflows.md
   * Workflow Q) — availability is only checked at acceptance/checkout.
   */
  async generateFromDraft(
    customerProfileId: string,
    customerUserId: string,
    customerEmail: string,
    rawDraftLines: QuoteDraftLine[],
  ): Promise<Result<{ quotationId: string; reference: string }>> {
    const draftLines = dedupeDraftLines(rawDraftLines).slice(0, MAX_DRAFT_LINES);
    if (draftLines.length === 0) {
      return err("Add at least one item to your quote first.");
    }

    const listingIds = draftLines.map((line) => line.listingId);
    const listings = await quotationRepository.findListingsForDraft(listingIds);
    const listingById = new Map(listings.map((listing) => [listing.id, listing]));
    const tiersByListing = await pricingService.getBulkTiersForListings(listingIds);

    const preparedItems: {
      listingId: string;
      vendorId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      vendorPayableBasis: number;
      lineTotal: number;
    }[] = [];
    let subtotal = 0;
    let currency = "GHS";

    for (const line of draftLines) {
      const listing = listingById.get(line.listingId);
      if (!listing || listing.approvalStatus !== "APPROVED" || listing.listingStatus !== "ACTIVE") {
        return err("An item in your quote is no longer available. Please review your quote.");
      }
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        return err(`Enter a valid quantity for ${listing.title}.`);
      }
      if (line.quantity < listing.moq) {
        return err(`${listing.title}: minimum order quantity is ${listing.moq}.`);
      }
      if (listing.maxOq && line.quantity > listing.maxOq) {
        return err(`${listing.title}: maximum order quantity is ${listing.maxOq}.`);
      }

      const tiers = tiersByListing.get(line.listingId) ?? [];
      const unitPrice = resolveUnitPrice(listing.basePrice.toNumber(), tiers, line.quantity);
      const lineTotal = unitPrice * line.quantity;
      const vendorSupplyCost = listing.vendorCostRule?.vendorSupplyCost.toNumber() ?? unitPrice;
      const vendorPayableBasis = vendorSupplyCost * line.quantity;
      subtotal += lineTotal;
      currency = listing.currency;

      preparedItems.push({
        listingId: listing.id,
        vendorId: listing.vendorId,
        description: listing.title,
        quantity: line.quantity,
        unitPrice,
        vendorPayableBasis,
        lineTotal,
      });
    }

    const expiresAt = new Date(Date.now() + env.QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const reference = generateQuoteReference();
      try {
        const quotation = await quotationRepository.createIssuedQuotation({
          reference,
          customerProfileId,
          currency,
          subtotal,
          total: subtotal,
          expiresAt,
          items: preparedItems,
        });

        const expiresAtText = quotation.expiresAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        await notificationsService.notify({
          recipientUserId: customerUserId,
          type: "QUOTE_ISSUED",
          title: "Your quotation is ready",
          body: `Your CrownSourceGlobal quotation ${quotation.reference} is ready: ${currency} ${subtotal.toFixed(2)}.`,
          targetUrl: notificationLinks.customerQuote(quotation.id),
          eventKey: `quote-issued:${quotation.id}`,
          email: {
            to: customerEmail,
            subject: "Your quotation is ready",
            templateKey: "quote-issued",
            templateData: { reference: quotation.reference, total: subtotal, currency, expiresAt: expiresAtText, quotationId: quotation.id },
          },
        });

        return ok({ quotationId: quotation.id, reference: quotation.reference });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 2) {
          continue; // reference collision — retry with a freshly generated one
        }
        console.error("Quote generation failed unexpectedly:", error);
        return err("Something went wrong generating your quote. Please try again.");
      }
    }

    return err("Something went wrong generating your quote. Please try again.");
  },

  async getDetailForCustomer(id: string, customerProfileId: string): Promise<QuotationDetailView | null> {
    const quotation = await quotationRepository.findDetailForCustomer(id, customerProfileId);
    if (!quotation) return null;

    if (quotation.status === "ISSUED" && quotation.expiresAt.getTime() < Date.now()) {
      void quotationRepository.markExpiredIfDue(id).catch(() => {});
    }

    return {
      id: quotation.id,
      reference: quotation.reference,
      issuedAt: quotation.issuedAt,
      expiresAt: quotation.expiresAt,
      acceptedAt: quotation.acceptedAt,
      status: deriveEffectiveStatus(quotation.status, quotation.expiresAt),
      currency: quotation.currency,
      subtotal: quotation.subtotal.toNumber(),
      total: quotation.total.toNumber(),
      items: quotation.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
        // A CUSTOM_SOURCING quote's internal vendorId (when populated) only
        // ever drives automatic Fulfilment creation — the customer never
        // sees supplier identity for a managed-sourcing line (M6 §23/§31),
        // regardless of whether the DB row happens to carry one.
        vendor: quotation.origin === "CUSTOM_SOURCING" ? null : item.vendor,
      })),
      acceptedOrderId: quotation.order?.id ?? null,
    };
  },

  async listForCustomer(customerProfileId: string): Promise<QuotationSummaryView[]> {
    const quotations = await quotationRepository.listForCustomer(customerProfileId);
    return quotations.map((quotation) => ({
      id: quotation.id,
      reference: quotation.reference,
      issuedAt: quotation.issuedAt,
      expiresAt: quotation.expiresAt,
      status: deriveEffectiveStatus(quotation.status, quotation.expiresAt),
      total: quotation.total.toNumber(),
      currency: quotation.currency,
      itemCount: quotation.items.length,
    }));
  },

  /** Feeds "Get Updated Quote" — a fresh draft seeded from an expired/old quote's lines, re-validated from scratch. */
  async getLinesForReissue(id: string, customerProfileId: string): Promise<QuoteDraftLine[] | null> {
    const quotation = await quotationRepository.findLinesForReissue(id, customerProfileId);
    if (!quotation) return null;
    return quotation.items
      .filter((item): item is { listingId: string; quantity: number } => item.listingId !== null)
      .map((item) => ({ listingId: item.listingId, quantity: item.quantity }));
  },

  /**
   * M6 — staff-prepared quote for a CustomSourcingRequest. Called from
   * modules/sourcing/service.ts, which owns all the sourcing-specific
   * validation (allocation-sum check, single-vendor derivation) and
   * side-effects (request status transition, activity log, email) —
   * this function's only job is the generic, reusable "write an issued
   * Quotation, superseding a prior active one if given" mechanism, the
   * same one M5's INSTANT path already relies on.
   */
  async issueCustomSourcingQuote(params: {
    customerProfileId: string;
    sourcingRequestId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vendorPayableBasis: number;
    vendorId: string | null;
  }): Promise<Result<{ quotationId: string; reference: string }>> {
    const existingActive = await quotationRepository.findActiveQuotationForSourcingRequest(params.sourcingRequestId);
    const expiresAt = new Date(Date.now() + env.QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const reference = generateQuoteReference();
      try {
        const quotation = await quotationRepository.issueCustomSourcingQuotation({
          reference,
          customerProfileId: params.customerProfileId,
          sourcingRequestId: params.sourcingRequestId,
          supersedesQuotationId: existingActive?.id,
          currency: "GHS",
          description: params.description,
          quantity: params.quantity,
          unitPrice: params.unitPrice,
          vendorPayableBasis: params.vendorPayableBasis,
          vendorId: params.vendorId,
          expiresAt,
        });
        return ok({ quotationId: quotation.id, reference: quotation.reference });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 2) {
          continue; // reference collision — retry with a freshly generated one
        }
        console.error("Custom sourcing quote issuance failed unexpectedly:", error);
        return err("Something went wrong preparing this quotation. Please try again.");
      }
    }

    return err("Something went wrong preparing this quotation. Please try again.");
  },

  async listForAdmin(status?: "ISSUED" | "ACCEPTED" | "EXPIRED"): Promise<AdminQuotationSummaryView[]> {
    const quotations = await quotationRepository.listForAdmin(status);
    return quotations.map((quotation) => ({
      id: quotation.id,
      reference: quotation.reference,
      origin: quotation.origin,
      issuedAt: quotation.issuedAt,
      expiresAt: quotation.expiresAt,
      status: deriveEffectiveStatus(quotation.status, quotation.expiresAt),
      total: quotation.total.toNumber(),
      currency: quotation.currency,
      itemCount: quotation.items.length,
      customerName: quotation.customerProfile.displayName,
      customerEmail: quotation.customerProfile.user.email,
    }));
  },

  async getDetailForAdmin(id: string): Promise<AdminQuotationDetailView | null> {
    const quotation = await quotationRepository.findDetailForAdmin(id);
    if (!quotation) return null;

    return {
      id: quotation.id,
      reference: quotation.reference,
      issuedAt: quotation.issuedAt,
      expiresAt: quotation.expiresAt,
      acceptedAt: quotation.acceptedAt,
      status: deriveEffectiveStatus(quotation.status, quotation.expiresAt),
      currency: quotation.currency,
      subtotal: quotation.subtotal.toNumber(),
      total: quotation.total.toNumber(),
      acceptedOrderId: quotation.order?.id ?? null,
      customerName: quotation.customerProfile.displayName,
      customerEmail: quotation.customerProfile.user.email,
      items: quotation.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
        vendorPayableBasis: item.vendorPayableBasis.toNumber(),
        vendor: item.vendor,
      })),
    };
  },
};
