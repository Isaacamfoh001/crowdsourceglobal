import type { AttentionSeverity } from "../operations/policy";

export type AttentionType =
  | "DELIVERY_ISSUE"
  | "FULFILMENT_OVERDUE"
  | "INTERNATIONAL_AWAITING_RECEIPT"
  | "SOURCING_UNASSIGNED"
  | "SOURCING_STALE"
  | "SOURCING_DEADLINE_RISK"
  | "MESSAGE_UNANSWERED"
  | "VENDOR_APPLICATION_PENDING"
  | "LISTING_MODERATION_PENDING"
  | "QUOTATION_NEARING_EXPIRY"
  | "RESOLUTION_UNASSIGNED"
  | "RESOLUTION_STALE"
  | "VENDOR_RESPONSE_OVERDUE"
  | "RETURN_AWAITING_INSPECTION"
  | "REFUND_FAILED";

export type AttentionModule = "OPERATIONS" | "SOURCING" | "MESSAGES" | "VENDOR_APPLICATIONS" | "LISTINGS" | "QUOTATIONS" | "RESOLUTIONS";

/**
 * Always derived at read time from source-of-truth domain records, never
 * persisted — an item disappears automatically the moment the underlying
 * condition resolves (see docs/architecture/overview.md "Admin Operations
 * Dashboard"). `targetUrl` always points back to the existing detail page
 * for the source record; this view never becomes a second authoritative
 * system.
 */
export type AttentionItem = {
  type: AttentionType;
  module: AttentionModule;
  severity: AttentionSeverity;
  reference: string;
  description: string;
  status: string;
  ageLabel: string;
  ageHours: number;
  assignedTo: string | null;
  targetUrl: string;
};

export type DateRange = "today" | "7d" | "30d";

export type TodayKpis = {
  ordersConfirmed: number;
  ordersDelivered: number;
  sourcingRequestsSubmitted: number;
  vendorApplicationsReceived: number;
  quotesIssued: number;
};

export type CurrentKpis = {
  activeVendors: number;
  activeListings: number;
  fulfilmentsInProgress: number;
};

export type SummaryCounts = {
  ordersRequiringAction: number;
  readyForCollection: number;
  deliveryIssues: number;
  pendingVendorApplications: number;
  listingsAwaitingReview: number;
  activeSourcingRequests: number;
  unansweredConversations: number;
  openResolutionCases: number;
  awaitingCustomer: number;
  awaitingVendor: number;
  returnsAwaitingInspection: number;
  refundsPending: number;
};

export type RecentActivityEntry = {
  label: string;
  at: Date;
  targetUrl: string;
};

export type DashboardData = {
  attentionItems: AttentionItem[];
  summary: SummaryCounts;
  todayKpis: TodayKpis;
  currentKpis: CurrentKpis;
  recentActivity: RecentActivityEntry[];
};

export type SearchResultType = "ORDER" | "QUOTATION" | "SOURCING_REQUEST" | "VENDOR" | "CUSTOMER" | "LISTING" | "SHIPMENT" | "RESOLUTION_CASE";

export type SearchResult = {
  type: SearchResultType;
  label: string;
  sublabel: string;
  targetUrl: string;
};
