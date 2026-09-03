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
  // M15 — narrow, low-volume admin event, same reasoning as the other ADMIN_* rows above.
  ADMIN_NEW_TALENT_APPLICATION: { required: true },
  // M21 — Explore moderation outcomes, same reasoning as LISTING_APPROVED/
  // CHANGES_REQUESTED/REJECTED above: a vendor's ability to reach customers
  // depends on knowing the outcome.
  EXPLORE_POST_APPROVED: { required: true },
  EXPLORE_POST_CHANGES_REQUESTED: { required: true },
  EXPLORE_POST_REJECTED: { required: true },
  // M22 — Beauty Professional moderation outcomes, same reasoning as
  // EXPLORE_POST_*/LISTING_* above. Service-request submission/decision
  // notices are required for the same "submission receipt"/"decisive
  // outcome" reasoning as SOURCING_REQUEST_SUBMITTED/RESOLUTION_APPROVED.
  BEAUTY_PROFESSIONAL_APPROVED: { required: true },
  BEAUTY_PROFESSIONAL_CHANGES_REQUESTED: { required: true },
  BEAUTY_PROFESSIONAL_REJECTED: { required: true },
  SERVICE_REQUEST_SUBMITTED: { required: true },
  SERVICE_REQUEST_ACCEPTED: { required: true },
  SERVICE_REQUEST_DECLINED: { required: true },
  // M25.2 — factory solicitation lifecycle. The factory-facing notice is a
  // sourcing-adjacent commerce opportunity, same category as QUOTE_ISSUED/
  // SOURCING_QUOTE_READY; the admin-facing "a factory responded" notice is
  // a narrow, low-volume admin event, same reasoning as the other ADMIN_*
  // rows above.
  VENDOR_SOURCING_SOLICITATION_RECEIVED: { required: false, category: "QUOTATIONS_SOURCING" },
  ADMIN_SOURCING_SOLICITATION_RESPONDED: { required: true },
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

/**
 * (M31) Which NotificationTypes are worth a lock-screen interruption vs.
 * in-app-inbox-only. A fixed, evidence-based classification — not a user
 * preference (no push-preferences UI exists; same "don't redesign
 * preferences" scope boundary M31 draws) and not simply "required ===
 * push" (email's REQUIRED flag answers a different question — "must this
 * reach an inbox the user might not open for days" — than push's "is this
 * worth interrupting someone right now"). `false` below falls into one of
 * three evidence-based groups, read from each type's actual `notify()`
 * call site rather than assumed:
 *
 * 1. Self-acknowledgements — the recipient IS the user who just performed
 *    the action (VENDOR_APPLICATION_SUBMITTED, SOURCING_REQUEST_SUBMITTED,
 *    RESOLUTION_CASE_RECEIVED all notify `submittedByUserId`/`userId`, the
 *    submitter themselves — see modules/vendor-applications/service.ts,
 *    modules/sourcing/service.ts, modules/resolutions/service.ts). They're
 *    typically still looking at the confirmation screen that action just
 *    produced — a push adds no information.
 * 2. ADMIN_* types — every one targets a web-only `/admin/*` targetUrl
 *    (modules/notifications/links.ts), and M30 established there is no
 *    mobile admin surface at all; a push would open the app to a dead end
 *    (mobile's destination.ts returns null for every `/admin/*` path).
 * 3. RESOLUTION_VENDOR_CASE_UPDATE — the non-required, informational
 *    sibling of RESOLUTION_VENDOR_RESPONSE_NEEDED (which IS pushed,
 *    because it needs the vendor to act); pushing both would double-notify
 *    the same case for what is really one actionable event.
 *
 * Everything mapped `true` is a genuine "something changed that this
 * specific person doesn't yet know and may want to act on" event —
 * order/payment progress, moderation/application outcomes, quotation/
 * sourcing readiness, resolution/refund outcomes, a staff/CrownSource
 * reply, or an order/request now requiring the recipient's action.
 */
const PUSH_POLICY: Record<NotificationType, boolean> = {
  VENDOR_APPLICATION_SUBMITTED: false, // self-ack
  VENDOR_APPLICATION_APPROVED: true,
  VENDOR_APPLICATION_CHANGES_REQUESTED: true,
  VENDOR_APPLICATION_REJECTED: true,
  LISTING_APPROVED: true,
  LISTING_CHANGES_REQUESTED: true,
  LISTING_REJECTED: true,
  ORDER_CONFIRMED: true,
  VENDOR_NEW_ORDER: true,
  COLLECTION_SCHEDULED: true,
  PACKAGE_COLLECTED: true,
  OUT_FOR_DELIVERY: true,
  DELIVERED: true,
  DELIVERY_ISSUE: true,
  FULFILMENT_ISSUE_RESOLVED: true,
  QUOTE_ISSUED: true,
  SOURCING_REQUEST_SUBMITTED: false, // self-ack
  SOURCING_CLARIFICATION_NEEDED: true,
  SOURCING_QUOTE_READY: true,
  SOURCING_UNABLE_TO_SOURCE: true,
  STAFF_REPLY: true,
  VENDOR_STAFF_REPLY: true,
  ADMIN_NEW_VENDOR_APPLICATION: false, // admin/web-only
  ADMIN_NEW_SOURCING_REQUEST: false, // admin/web-only
  ADMIN_NEW_MESSAGE: false, // admin/web-only
  RESOLUTION_CASE_RECEIVED: false, // self-ack
  RESOLUTION_CLARIFICATION_NEEDED: true,
  RESOLUTION_APPROVED: true,
  RETURN_APPROVED: true,
  REFUND_APPROVED: true,
  REFUND_COMPLETED: true,
  REPLACEMENT_CREATED: true,
  RESOLUTION_CASE_RESOLVED: true,
  RESOLUTION_VENDOR_RESPONSE_NEEDED: true,
  RESOLUTION_VENDOR_CASE_UPDATE: false, // informational sibling of RESPONSE_NEEDED
  ADMIN_NEW_RESOLUTION_CASE: false, // admin/web-only
  ADMIN_REFUND_FAILED: false, // admin/web-only
  PAYMENT_FAILED: true,
  ADMIN_PAYMENT_REQUIRES_ATTENTION: false, // admin/web-only
  VENDOR_EARNING_ON_HOLD: true,
  VENDOR_SETTLEMENT_APPROVED: true,
  VENDOR_SETTLEMENT_PAID: true,
  ADMIN_NEW_TALENT_APPLICATION: false, // admin/web-only
  EXPLORE_POST_APPROVED: true,
  EXPLORE_POST_CHANGES_REQUESTED: true,
  EXPLORE_POST_REJECTED: true,
  BEAUTY_PROFESSIONAL_APPROVED: true,
  BEAUTY_PROFESSIONAL_CHANGES_REQUESTED: true,
  BEAUTY_PROFESSIONAL_REJECTED: true,
  SERVICE_REQUEST_SUBMITTED: true, // notifies the professional/vendor — needs their action
  SERVICE_REQUEST_ACCEPTED: true,
  SERVICE_REQUEST_DECLINED: true,
  VENDOR_SOURCING_SOLICITATION_RECEIVED: true, // notifies the vendor — needs their action
  ADMIN_SOURCING_SOLICITATION_RESPONDED: false, // admin/web-only
};

/** Push is best-effort and additive on top of the always-created in-app Notification — never gated by user preference (no push-preferences UI exists yet). */
export function shouldSendPush(type: NotificationType): boolean {
  return PUSH_POLICY[type];
}
