import { adminDashboardRepository } from "./repository";
import { vendorApplicationsService } from "../vendor-applications/service";
import { vendorListingsService } from "../vendor-listings/service";
import { sourcingService } from "../sourcing/service";
import { fulfilmentService } from "../fulfilment/service";
import { quotationService } from "../quotation/service";
import { messagingRepository } from "../messaging/repository";
import {
  ageHours,
  formatAge,
  severityForAge,
  severityForQuotationExpiry,
  canAccessOperationalModules,
  THRESHOLDS,
} from "../operations/policy";
import type { AdminRole } from "../administration/policy";
import type { AttentionItem, DashboardData, DateRange, SearchResult } from "./types";

const SEVERITY_ORDER: Record<AttentionItem["severity"], number> = { CRITICAL: 0, NEEDS_ATTENTION: 1, NORMAL: 2 };

// --- Attention item builders (one per source module) ------------------

async function vendorApplicationAttention(now: Date): Promise<AttentionItem[]> {
  const applications = await vendorApplicationsService.listForAdmin(["SUBMITTED"]);
  const items: AttentionItem[] = [];
  for (const app of applications) {
    const since = app.submittedAt ?? app.createdAt;
    const hours = ageHours(since, now);
    const severity = severityForAge(hours, THRESHOLDS.vendorApplicationWarningHours);
    if (severity === "NORMAL") continue;
    items.push({
      type: "VENDOR_APPLICATION_PENDING",
      module: "VENDOR_APPLICATIONS",
      severity,
      reference: app.displayName ?? app.applicantName,
      description: `Vendor application from ${app.applicantName} awaiting review`,
      status: app.status,
      ageLabel: formatAge(since, now),
      ageHours: hours,
      assignedTo: null,
      targetUrl: `/admin/vendor-applications/${app.id}`,
    });
  }
  return items;
}

async function listingAttention(now: Date): Promise<AttentionItem[]> {
  const listings = await vendorListingsService.listPendingForAdmin();
  const items: AttentionItem[] = [];
  for (const listing of listings) {
    const hours = ageHours(listing.submittedAt, now);
    const severity = severityForAge(hours, THRESHOLDS.listingReviewWarningHours);
    if (severity === "NORMAL") continue;
    items.push({
      type: "LISTING_MODERATION_PENDING",
      module: "LISTINGS",
      severity,
      reference: listing.title,
      description: `${listing.isEdit ? "Listing edit" : "New listing"} from ${listing.vendorName} awaiting review`,
      status: listing.approvalStatus,
      ageLabel: formatAge(listing.submittedAt, now),
      ageHours: hours,
      assignedTo: null,
      targetUrl: `/admin/listings/${listing.id}`,
    });
  }
  return items;
}

const OPEN_SOURCING_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "SOURCING", "AWAITING_CUSTOMER"]);
const DEADLINE_RISK_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "SOURCING", "AWAITING_CUSTOMER", "QUOTED"]);

async function sourcingAttention(now: Date): Promise<AttentionItem[]> {
  const requests = await sourcingService.listForAdmin({});
  const items: AttentionItem[] = [];
  for (const request of requests) {
    if (OPEN_SOURCING_STATUSES.has(request.status)) {
      if (!request.assignedStaffId) {
        items.push({
          type: "SOURCING_UNASSIGNED",
          module: "SOURCING",
          severity: "NEEDS_ATTENTION",
          reference: request.requestNumber,
          description: `"${request.title}" has no assigned staff`,
          status: request.statusLabel,
          ageLabel: formatAge(request.submittedAt, now),
          ageHours: ageHours(request.submittedAt, now),
          assignedTo: null,
          targetUrl: `/admin/sourcing/${request.id}`,
        });
      } else {
        const hours = ageHours(request.updatedAt, now);
        const severity = severityForAge(hours, THRESHOLDS.sourcingStaleHours);
        if (severity !== "NORMAL") {
          items.push({
            type: "SOURCING_STALE",
            module: "SOURCING",
            severity,
            reference: request.requestNumber,
            description: `"${request.title}" has had no activity`,
            status: request.statusLabel,
            ageLabel: formatAge(request.updatedAt, now),
            ageHours: hours,
            assignedTo: request.assignedStaffName,
            targetUrl: `/admin/sourcing/${request.id}`,
          });
        }
      }
    }
    if (request.requiredByDate && DEADLINE_RISK_STATUSES.has(request.status)) {
      const hoursRemaining = (request.requiredByDate.getTime() - now.getTime()) / (60 * 60 * 1000);
      const warningHours = THRESHOLDS.sourcingDeadlineWarningDays * 24;
      if (hoursRemaining <= warningHours) {
        items.push({
          type: "SOURCING_DEADLINE_RISK",
          module: "SOURCING",
          severity: hoursRemaining <= 0 ? "CRITICAL" : "NEEDS_ATTENTION",
          reference: request.requestNumber,
          description: `"${request.title}" required by ${request.requiredByDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — still ${request.statusLabel.toLowerCase()}`,
          status: request.statusLabel,
          ageLabel: hoursRemaining <= 0 ? "past due date" : formatAge(now, request.requiredByDate),
          ageHours: -hoursRemaining,
          assignedTo: request.assignedStaffName,
          targetUrl: `/admin/sourcing/${request.id}`,
        });
      }
    }
  }
  return items;
}

async function fulfilmentAttention(now: Date): Promise<AttentionItem[]> {
  const fulfilments = await fulfilmentService.listForAdmin({});
  const items: AttentionItem[] = [];
  for (const f of fulfilments) {
    const isFailedDelivery = f.shipmentStatus === "DELIVERY_FAILED";
    if (f.hasOpenIssue || f.status === "EXCEPTION" || isFailedDelivery) {
      items.push({
        type: "DELIVERY_ISSUE",
        module: "OPERATIONS",
        severity: "CRITICAL",
        reference: f.orderNumber,
        description: isFailedDelivery ? "Delivery attempt failed" : "Unresolved fulfilment exception",
        status: f.status,
        ageLabel: formatAge(f.updatedAt, now),
        ageHours: ageHours(f.updatedAt, now),
        assignedTo: f.vendorName,
        targetUrl: `/admin/operations/${f.id}`,
      });
      continue; // an item already flagged CRITICAL doesn't also need the overdue/awaiting-receipt checks below
    }

    if (f.status === "PREPARING") {
      const thresholdHours = f.vendorLeadTimeDays != null ? f.vendorLeadTimeDays * 24 : THRESHOLDS.fulfilmentPreparingWarningHours;
      const hours = ageHours(f.updatedAt, now);
      const severity = severityForAge(hours, thresholdHours);
      if (severity !== "NORMAL") {
        items.push({
          type: "FULFILMENT_OVERDUE",
          module: "OPERATIONS",
          severity,
          reference: f.orderNumber,
          description: `Vendor has not progressed from preparation${f.vendorLeadTimeDays != null ? ` (expected within ${f.vendorLeadTimeDays}d)` : ""}`,
          status: f.status,
          ageLabel: formatAge(f.updatedAt, now),
          ageHours: hours,
          assignedTo: f.vendorName,
          targetUrl: `/admin/operations/${f.id}`,
        });
      }
    }

    if (f.origin === "INTERNATIONAL_INBOUND" && f.shipmentShippedAt && !f.shipmentReceivedAt) {
      const hours = ageHours(f.shipmentShippedAt, now);
      const severity = severityForAge(hours, THRESHOLDS.fulfilmentPreparingWarningHours);
      if (severity !== "NORMAL") {
        items.push({
          type: "INTERNATIONAL_AWAITING_RECEIPT",
          module: "OPERATIONS",
          severity,
          reference: f.orderNumber,
          description: "Vendor has shipped — awaiting CrownSource receipt confirmation",
          status: f.status,
          ageLabel: formatAge(f.shipmentShippedAt, now),
          ageHours: hours,
          assignedTo: f.vendorName,
          targetUrl: `/admin/operations/${f.id}`,
        });
      }
    }
  }
  return items;
}

async function messageAttention(now: Date): Promise<AttentionItem[]> {
  const conversations = await messagingRepository.findOpenConversationsForAttention();
  const items: AttentionItem[] = [];
  for (const c of conversations) {
    const last = c.messages[0];
    if (!last || last.senderIsStaff) continue; // last word was staff's — no immediate staff action needed
    const hours = ageHours(last.createdAt, now);
    const severity = severityForAge(hours, THRESHOLDS.messageResponseWarningHours);
    if (severity === "NORMAL") continue;
    const counterparty = c.participantType === "CUSTOMER" ? (c.customerProfile?.displayName ?? "Customer") : (c.vendor?.companyName ?? "Vendor");
    items.push({
      type: "MESSAGE_UNANSWERED",
      module: "MESSAGES",
      severity,
      reference: counterparty,
      description: `${c.participantType === "CUSTOMER" ? "Customer" : "Vendor"} message awaiting a CrownSource reply`,
      status: "Awaiting reply",
      ageLabel: formatAge(last.createdAt, now),
      ageHours: hours,
      assignedTo: null,
      targetUrl: `/admin/messages/${c.id}`,
    });
  }
  return items;
}

async function quotationAttention(now: Date): Promise<AttentionItem[]> {
  const quotations = await quotationService.listForAdmin("ISSUED");
  const items: AttentionItem[] = [];
  for (const q of quotations) {
    if (q.origin !== "CUSTOM_SOURCING") continue; // instant quotes are routine — never nag staff about them (M8 spec)
    const severity = severityForQuotationExpiry(q.expiresAt, now);
    if (severity === "NORMAL") continue;
    items.push({
      type: "QUOTATION_NEARING_EXPIRY",
      module: "QUOTATIONS",
      severity,
      reference: q.reference,
      description: `Custom quote for ${q.customerName} nearing expiry, not yet accepted`,
      status: "Issued",
      ageLabel: `expires in ${formatAge(now, q.expiresAt)}`,
      ageHours: -ageHours(now, q.expiresAt),
      assignedTo: null,
      targetUrl: `/admin/quotations/${q.id}`,
    });
  }
  return items;
}

const OPEN_RESOLUTION_STATUSES_UNASSIGNED = new Set(["OPEN", "UNDER_REVIEW"]);

/**
 * M9 — three ageing-based sub-categories out of a single query. A case
 * awaiting the CUSTOMER's reply is deliberately NOT flagged here: that
 * direction is already covered for free by messageAttention() above (any
 * open conversation — including a resolution case's — whose last message
 * isn't from staff already surfaces as MESSAGE_UNANSWERED, regardless of
 * context). VENDOR_RESPONSE_OVERDUE is the one direction messageAttention
 * can't see: a case sitting in AWAITING_VENDOR is a case-status fact, not
 * necessarily a message-recency fact.
 */
async function resolutionCaseAttention(now: Date): Promise<AttentionItem[]> {
  const cases = await adminDashboardRepository.findOpenResolutionCasesForAttention();
  const items: AttentionItem[] = [];
  for (const c of cases) {
    if (OPEN_RESOLUTION_STATUSES_UNASSIGNED.has(c.status) && !c.assignedStaffId) {
      const hours = ageHours(c.updatedAt, now);
      const severity = severityForAge(hours, THRESHOLDS.resolutionUnassignedWarningHours);
      if (severity !== "NORMAL") {
        items.push({
          type: "RESOLUTION_UNASSIGNED",
          module: "RESOLUTIONS",
          severity,
          reference: c.caseNumber,
          description: `Case on order ${c.order.orderNumber} has no assigned staff`,
          status: c.status,
          ageLabel: formatAge(c.updatedAt, now),
          ageHours: hours,
          assignedTo: null,
          targetUrl: `/admin/resolutions/${c.id}`,
        });
      }
    } else if (c.status === "UNDER_REVIEW" && c.assignedStaffId) {
      const hours = ageHours(c.updatedAt, now);
      const severity = severityForAge(hours, THRESHOLDS.resolutionReviewWarningHours);
      if (severity !== "NORMAL") {
        items.push({
          type: "RESOLUTION_STALE",
          module: "RESOLUTIONS",
          severity,
          reference: c.caseNumber,
          description: `Case on order ${c.order.orderNumber} has been under review with no update`,
          status: c.status,
          ageLabel: formatAge(c.updatedAt, now),
          ageHours: hours,
          assignedTo: "assigned",
          targetUrl: `/admin/resolutions/${c.id}`,
        });
      }
    } else if (c.status === "AWAITING_VENDOR") {
      const hours = ageHours(c.updatedAt, now);
      const severity = severityForAge(hours, THRESHOLDS.resolutionReviewWarningHours);
      if (severity !== "NORMAL") {
        items.push({
          type: "VENDOR_RESPONSE_OVERDUE",
          module: "RESOLUTIONS",
          severity,
          reference: c.caseNumber,
          description: `Case on order ${c.order.orderNumber} is waiting on a vendor response`,
          status: c.status,
          ageLabel: formatAge(c.updatedAt, now),
          ageHours: hours,
          assignedTo: null,
          targetUrl: `/admin/resolutions/${c.id}`,
        });
      }
    }
  }
  return items;
}

async function returnInspectionAttention(now: Date): Promise<AttentionItem[]> {
  const returns = await adminDashboardRepository.findReturnsAwaitingInspectionForAttention();
  const items: AttentionItem[] = [];
  for (const r of returns) {
    const hours = ageHours(r.updatedAt, now);
    const severity = severityForAge(hours, THRESHOLDS.returnInspectionWarningHours);
    if (severity === "NORMAL") continue;
    items.push({
      type: "RETURN_AWAITING_INSPECTION",
      module: "RESOLUTIONS",
      severity,
      reference: r.resolutionCase.caseNumber,
      description: `Returned item for order ${r.resolutionCase.order.orderNumber} awaiting inspection`,
      status: "Received",
      ageLabel: formatAge(r.updatedAt, now),
      ageHours: hours,
      assignedTo: null,
      targetUrl: `/admin/resolutions/${r.resolutionCase.id}`,
    });
  }
  return items;
}

async function refundFailedAttention(now: Date): Promise<AttentionItem[]> {
  const refunds = await adminDashboardRepository.findFailedRefundsForAttention();
  return refunds.map((refund) => ({
    type: "REFUND_FAILED" as const,
    module: "RESOLUTIONS" as const,
    severity: "CRITICAL" as const,
    reference: refund.resolutionCase.caseNumber,
    description: `Refund for order ${refund.resolutionCase.order.orderNumber} failed to process`,
    status: "Failed",
    ageLabel: formatAge(refund.updatedAt, now),
    ageHours: ageHours(refund.updatedAt, now),
    assignedTo: null,
    targetUrl: `/admin/resolutions/${refund.resolutionCase.id}`,
  }));
}

/** Fetches and normalizes every attention category the given role is permitted to see, severity-sorted, most-severe first. */
async function collectAttentionItems(role: AdminRole, now: Date): Promise<AttentionItem[]> {
  const operationalAllowed = canAccessOperationalModules(role);
  const builders = [
    vendorApplicationAttention(now),
    listingAttention(now),
    quotationAttention(now),
    ...(operationalAllowed
      ? [sourcingAttention(now), fulfilmentAttention(now), messageAttention(now), resolutionCaseAttention(now), returnInspectionAttention(now), refundFailedAttention(now)]
      : []),
  ];
  const results = await Promise.all(builders.map((p) => p.catch((error) => { console.error("[admin-dashboard] attention section failed:", error); return [] as AttentionItem[]; })));
  return results.flat().sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.ageHours - a.ageHours);
}

export const adminDashboardService = {
  async getDashboardData(role: AdminRole): Promise<DashboardData> {
    const now = new Date();
    const since = adminDashboardRepository.rangeStart("today", now);
    const operationalAllowed = canAccessOperationalModules(role);

    const safe = <T>(promise: Promise<T>, fallback: T): Promise<T> =>
      promise.catch((error) => {
        console.error("[admin-dashboard] section failed:", error);
        return fallback;
      });

    const [
      attentionItems,
      ordersConfirmed,
      ordersDelivered,
      sourcingRequestsSubmitted,
      vendorApplicationsReceived,
      quotesIssued,
      activeVendors,
      activeListings,
      fulfilmentsInProgress,
      readyForCollection,
      deliveryIssues,
      pendingVendorApplications,
      listingsAwaitingReview,
      activeSourcingRequests,
      unansweredConversations,
      openResolutionCases,
      awaitingCustomer,
      awaitingVendor,
      returnsAwaitingInspection,
      refundsPending,
      recentActivity,
    ] = await Promise.all([
      safe(collectAttentionItems(role, now), []),
      safe(adminDashboardRepository.countOrdersConfirmed(since), 0),
      safe(adminDashboardRepository.countShipmentsDelivered(since), 0),
      safe(adminDashboardRepository.countSourcingRequestsSubmitted(since), 0),
      safe(adminDashboardRepository.countVendorApplicationsReceived(since), 0),
      safe(adminDashboardRepository.countQuotesIssued(since), 0),
      safe(adminDashboardRepository.countActiveVendors(), 0),
      safe(adminDashboardRepository.countActiveListings(), 0),
      safe(operationalAllowed ? adminDashboardRepository.countFulfilmentsInProgress() : Promise.resolve(0), 0),
      safe(operationalAllowed ? adminDashboardRepository.countReadyForCollection() : Promise.resolve(0), 0),
      safe(operationalAllowed ? adminDashboardRepository.countOpenDeliveryIssues() : Promise.resolve(0), 0),
      safe(vendorApplicationsService.listForAdmin(["SUBMITTED"]).then((r) => r.length), 0),
      safe(vendorListingsService.listPendingForAdmin().then((r) => r.length), 0),
      safe(sourcingService.listForAdmin({}).then((r) => r.filter((req) => OPEN_SOURCING_STATUSES.has(req.status)).length), 0),
      safe(operationalAllowed ? messagingRepository.findOpenConversationsForAttention().then((rows) => rows.filter((c) => c.messages[0] && !c.messages[0].senderIsStaff).length) : Promise.resolve(0), 0),
      safe(operationalAllowed ? adminDashboardRepository.countOpenResolutionCases() : Promise.resolve(0), 0),
      safe(operationalAllowed ? adminDashboardRepository.countResolutionCasesByStatus("AWAITING_CUSTOMER") : Promise.resolve(0), 0),
      safe(operationalAllowed ? adminDashboardRepository.countResolutionCasesByStatus("AWAITING_VENDOR") : Promise.resolve(0), 0),
      safe(operationalAllowed ? adminDashboardRepository.countReturnsAwaitingInspection() : Promise.resolve(0), 0),
      safe(operationalAllowed ? adminDashboardRepository.countRefundsPending() : Promise.resolve(0), 0),
      safe(operationalAllowed ? adminDashboardRepository.recentActivity() : Promise.resolve({ approvedApplications: [], deliveredShipments: [], sourcingActivity: [] }), { approvedApplications: [], deliveredShipments: [], sourcingActivity: [] }),
    ]);

    const activity = [
      ...recentActivity.approvedApplications.filter((a) => a.reviewedAt).map((a) => ({
        label: `Vendor application approved: ${a.displayName ?? "applicant"}`,
        at: a.reviewedAt as Date,
        targetUrl: `/admin/vendor-applications/${a.id}`,
      })),
      ...recentActivity.deliveredShipments.filter((s) => s.deliveredAt).map((s) => ({
        label: `Order ${s.fulfilment.order.orderNumber} delivered`,
        at: s.deliveredAt as Date,
        targetUrl: `/admin/operations/${s.fulfilment.id}`,
      })),
      ...recentActivity.sourcingActivity.map((a) => ({
        label: `Sourcing ${a.sourcingRequest.requestNumber}: ${a.type.replace(/_/g, " ")}`,
        at: a.createdAt,
        targetUrl: `/admin/sourcing/${a.sourcingRequestId}`,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 10);

    return {
      attentionItems,
      summary: {
        ordersRequiringAction: deliveryIssues + attentionItems.filter((i) => i.type === "FULFILMENT_OVERDUE").length,
        readyForCollection,
        deliveryIssues,
        pendingVendorApplications,
        listingsAwaitingReview,
        activeSourcingRequests,
        unansweredConversations,
        openResolutionCases,
        awaitingCustomer,
        awaitingVendor,
        returnsAwaitingInspection,
        refundsPending,
      },
      todayKpis: { ordersConfirmed, ordersDelivered, sourcingRequestsSubmitted, vendorApplicationsReceived, quotesIssued },
      currentKpis: { activeVendors, activeListings, fulfilmentsInProgress },
      recentActivity: activity,
    };
  },

  async getTodayKpis(role: AdminRole, range: DateRange) {
    const since = adminDashboardRepository.rangeStart(range);
    const [ordersConfirmed, ordersDelivered, sourcingRequestsSubmitted, vendorApplicationsReceived, quotesIssued] = await Promise.all([
      adminDashboardRepository.countOrdersConfirmed(since),
      adminDashboardRepository.countShipmentsDelivered(since),
      adminDashboardRepository.countSourcingRequestsSubmitted(since),
      adminDashboardRepository.countVendorApplicationsReceived(since),
      adminDashboardRepository.countQuotesIssued(since),
    ]);
    void role;
    return { ordersConfirmed, ordersDelivered, sourcingRequestsSubmitted, vendorApplicationsReceived, quotesIssued };
  },

  /** Full, filterable, paginated attention queue — the dashboard home only shows a bounded preview of this same data. */
  async getAttentionQueue(
    role: AdminRole,
    filters: { type?: string; severity?: string; module?: string; assigned?: "assigned" | "unassigned" },
    page: number,
  ): Promise<{ items: AttentionItem[]; total: number; page: number; pageSize: number }> {
    const pageSize = 25;
    const now = new Date();
    let items = await collectAttentionItems(role, now);
    if (filters.type) items = items.filter((i) => i.type === filters.type);
    if (filters.severity) items = items.filter((i) => i.severity === filters.severity);
    if (filters.module) items = items.filter((i) => i.module === filters.module);
    if (filters.assigned === "assigned") items = items.filter((i) => i.assignedTo !== null);
    if (filters.assigned === "unassigned") items = items.filter((i) => i.assignedTo === null);
    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  },

  async search(query: string, role: AdminRole): Promise<SearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const operationalAllowed = canAccessOperationalModules(role);

    const [orders, quotations, sourcing, listings, customers, ...operational] = await Promise.all([
      adminDashboardRepository.searchOrders(q),
      adminDashboardRepository.searchQuotations(q),
      adminDashboardRepository.searchSourcingRequests(q),
      adminDashboardRepository.searchListings(q),
      adminDashboardRepository.searchCustomers(q),
      ...(operationalAllowed
        ? [adminDashboardRepository.searchVendors(q), adminDashboardRepository.searchShipments(q), adminDashboardRepository.searchResolutionCases(q)]
        : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([])]),
    ]);
    const [vendors, shipments, resolutionCases] = operational as [
      Awaited<ReturnType<typeof adminDashboardRepository.searchVendors>>,
      Awaited<ReturnType<typeof adminDashboardRepository.searchShipments>>,
      Awaited<ReturnType<typeof adminDashboardRepository.searchResolutionCases>>,
    ];

    const customerTargets = await Promise.all(
      customers.map((c) => adminDashboardRepository.findRecentCustomerTarget(c.id)),
    );

    const results: SearchResult[] = [
      ...orders
        .filter((o) => o.fulfilments[0])
        .map((o) => ({
          type: "ORDER" as const,
          label: `Order ${o.orderNumber}`,
          sublabel: `${o.customerProfile.displayName} · ${o.status}`,
          targetUrl: `/admin/operations/${o.fulfilments[0]!.id}`,
        })),
      ...quotations.map((q) => ({
        type: "QUOTATION" as const,
        label: `Quote ${q.reference}`,
        sublabel: `${q.customerProfile.displayName} · ${q.status}`,
        targetUrl: `/admin/quotations/${q.id}`,
      })),
      ...sourcing.map((s) => ({
        type: "SOURCING_REQUEST" as const,
        label: s.requestNumber,
        sublabel: `${s.title} · ${s.status}`,
        targetUrl: `/admin/sourcing/${s.id}`,
      })),
      ...listings.map((l) => ({
        type: "LISTING" as const,
        label: l.title,
        sublabel: `${l.vendor.companyName} · ${l.approvalStatus}`,
        targetUrl: `/admin/listings/${l.id}`,
      })),
      ...customers
        .map((c, i) => ({ c, target: customerTargets[i] }))
        .filter((entry): entry is { c: (typeof customers)[number]; target: NonNullable<(typeof customerTargets)[number]> } => entry.target !== null)
        .map(({ c, target }) => ({
          type: "CUSTOMER" as const,
          label: c.displayName,
          sublabel: `${c.user.email} · ${target.label}`,
          targetUrl: target.targetUrl,
        })),
      ...vendors.map((v) => ({
        type: "VENDOR" as const,
        label: v.companyName,
        sublabel: `${v.verificationStatus} · storefront`,
        targetUrl: `/vendors/${v.storefrontSlug}`,
      })),
      ...shipments
        .filter((s) => s.trackingReference)
        .map((s) => ({
          type: "SHIPMENT" as const,
          label: s.trackingReference as string,
          sublabel: `Order ${s.fulfilment.order.orderNumber} · ${s.status}`,
          targetUrl: `/admin/operations/${s.fulfilmentId}`,
        })),
      ...resolutionCases.map((c) => ({
        type: "RESOLUTION_CASE" as const,
        label: c.caseNumber,
        sublabel: `Order ${c.order.orderNumber} · ${c.status}`,
        targetUrl: `/admin/resolutions/${c.id}`,
      })),
    ];
    return results;
  },
};
