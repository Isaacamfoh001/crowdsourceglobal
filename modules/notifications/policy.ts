import type { NotificationCategory, NotificationType, PreferencesView } from "./types";

type Policy = { required: true } | { required: false; category: NotificationCategory };

/**
 * The single source of truth for "must this email always send" vs. "does
 * the recipient's preference gate it." A DB config table here would be
 * unedited config nobody touches — CLAUDE.md's overengineering guidance
 * applies. REQUIRED covers moderation outcomes (a vendor's business
 * depends on knowing), commerce-critical confirmations, submission
 * receipts, and definitive negative sourcing outcomes — see
 * docs/domain/entities.md for the full rationale. Everything else maps to
 * one of the three togglable categories shown in Account → Notifications.
 * Admin-facing types are always required — no staff preference UI exists
 * in M7 (CLAUDE.md "avoid notification spam" cuts the other way for staff:
 * these are already narrow, targeted, low-volume events).
 */
const POLICY: Record<NotificationType, Policy> = {
  VENDOR_APPLICATION_SUBMITTED: { required: true },
  VENDOR_APPLICATION_APPROVED: { required: true },
  VENDOR_APPLICATION_CHANGES_REQUESTED: { required: true },
  VENDOR_APPLICATION_REJECTED: { required: true },
  LISTING_APPROVED: { required: true },
  LISTING_CHANGES_REQUESTED: { required: true },
  LISTING_REJECTED: { required: true },
  ORDER_CONFIRMED: { required: true },
  VENDOR_NEW_ORDER: { required: false, category: "ORDERS_DELIVERY" },
  COLLECTION_SCHEDULED: { required: false, category: "ORDERS_DELIVERY" },
  PACKAGE_COLLECTED: { required: false, category: "ORDERS_DELIVERY" },
  OUT_FOR_DELIVERY: { required: false, category: "ORDERS_DELIVERY" },
  DELIVERED: { required: false, category: "ORDERS_DELIVERY" },
  DELIVERY_ISSUE: { required: true },
  FULFILMENT_ISSUE_RESOLVED: { required: false, category: "ORDERS_DELIVERY" },
  QUOTE_ISSUED: { required: false, category: "QUOTATIONS_SOURCING" },
  SOURCING_REQUEST_SUBMITTED: { required: true },
  SOURCING_CLARIFICATION_NEEDED: { required: false, category: "QUOTATIONS_SOURCING" },
  SOURCING_QUOTE_READY: { required: false, category: "QUOTATIONS_SOURCING" },
  SOURCING_UNABLE_TO_SOURCE: { required: true },
  STAFF_REPLY: { required: false, category: "MESSAGES" },
  VENDOR_STAFF_REPLY: { required: false, category: "MESSAGES" },
  ADMIN_NEW_VENDOR_APPLICATION: { required: true },
  ADMIN_NEW_SOURCING_REQUEST: { required: true },
  ADMIN_NEW_MESSAGE: { required: true },
  // M9 — post-purchase resolution. Case lifecycle/financial-outcome events
  // are REQUIRED (a customer's money/order is directly at stake); only the
  // informational "case closed out" notice is optional, mapped to the same
  // ORDERS_DELIVERY category the rest of order-progress uses.
  RESOLUTION_CASE_RECEIVED: { required: true },
  RESOLUTION_CLARIFICATION_NEEDED: { required: true },
  RESOLUTION_APPROVED: { required: true },
  RETURN_APPROVED: { required: true },
  REFUND_APPROVED: { required: true },
  REFUND_COMPLETED: { required: true },
  REPLACEMENT_CREATED: { required: true },
  RESOLUTION_CASE_RESOLVED: { required: false, category: "ORDERS_DELIVERY" },
  RESOLUTION_VENDOR_RESPONSE_NEEDED: { required: true },
  RESOLUTION_VENDOR_CASE_UPDATE: { required: false, category: "ORDERS_DELIVERY" },
  ADMIN_NEW_RESOLUTION_CASE: { required: true },
  ADMIN_REFUND_FAILED: { required: true },
  // M10A — payment failure is commerce-critical (customer needs to know to
  // retry); payment exceptions are narrow, low-volume admin events, same
  // reasoning as the other ADMIN_* rows above.
  PAYMENT_FAILED: { required: true },
  ADMIN_PAYMENT_REQUIRES_ATTENTION: { required: true },
  // M11 — vendor finance. All three are financially significant to the
  // vendor (their earnings/payout), same "commerce-critical" reasoning as
  // REFUND_APPROVED/RESOLUTION_APPROVED above — never optional.
  VENDOR_EARNING_ON_HOLD: { required: true },
  VENDOR_SETTLEMENT_APPROVED: { required: true },
  VENDOR_SETTLEMENT_PAID: { required: true },
};

const CATEGORY_FIELD: Record<NotificationCategory, keyof PreferencesView> = {
  ORDERS_DELIVERY: "ordersDeliveryEmail",
  QUOTATIONS_SOURCING: "quotationsSourcingEmail",
  MESSAGES: "messagesEmail",
};

/** In-app notifications are never gated — this only ever governs the email channel. */
export function shouldSendEmail(type: NotificationType, preferences: PreferencesView): boolean {
  const policy = POLICY[type];
  if (policy.required) return true;
  return preferences[CATEGORY_FIELD[policy.category]];
}
