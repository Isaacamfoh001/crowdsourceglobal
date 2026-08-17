import { env } from "../../lib/env";
import type { AdminRole } from "../administration/policy";

/**
 * Centralized staff-attention ageing thresholds and classification logic
 * for the M8 admin operations dashboard (see docs/architecture/overview.md
 * "Admin Operations Dashboard"). These are operational V1 defaults, not
 * contractual SLAs — PROJECT.md does not mandate exact figures, so they
 * live here (configurable via lib/env.ts's OPS_* vars) rather than as
 * magic numbers scattered across modules/admin-dashboard.
 */

export type AttentionSeverity = "CRITICAL" | "NEEDS_ATTENTION" | "NORMAL";

export const THRESHOLDS = {
  vendorApplicationWarningHours: env.OPS_VENDOR_APPLICATION_WARNING_HOURS,
  listingReviewWarningHours: env.OPS_LISTING_REVIEW_WARNING_HOURS,
  messageResponseWarningHours: env.OPS_MESSAGE_RESPONSE_WARNING_HOURS,
  sourcingStaleHours: env.OPS_SOURCING_STALE_HOURS,
  fulfilmentPreparingWarningHours: env.OPS_FULFILMENT_PREPARING_WARNING_HOURS,
  sourcingDeadlineWarningDays: env.OPS_SOURCING_DEADLINE_WARNING_DAYS,
};

export function ageHours(since: Date, now: Date = new Date()): number {
  return (now.getTime() - since.getTime()) / (60 * 60 * 1000);
}

/**
 * Generic ageing-based severity: below the warning threshold is NORMAL
 * (routine, still within the expected processing window — not shown as an
 * attention item, only reflected in a plain count); the threshold up to
 * 2x is NEEDS_ATTENTION; 2x or beyond escalates to CRITICAL. A single,
 * shared escalation curve keeps every category's "how overdue is too
 * overdue" behavior consistent and centrally tunable.
 */
export function severityForAge(hours: number, warningThresholdHours: number): AttentionSeverity {
  if (hours >= warningThresholdHours * 2) return "CRITICAL";
  if (hours >= warningThresholdHours) return "NEEDS_ATTENTION";
  return "NORMAL";
}

export function isVendorApplicationStale(submittedAt: Date, now: Date = new Date()): boolean {
  return ageHours(submittedAt, now) >= THRESHOLDS.vendorApplicationWarningHours;
}

export function isListingReviewStale(submittedAt: Date, now: Date = new Date()): boolean {
  return ageHours(submittedAt, now) >= THRESHOLDS.listingReviewWarningHours;
}

export function isConversationOverdue(lastActivityAt: Date, now: Date = new Date()): boolean {
  return ageHours(lastActivityAt, now) >= THRESHOLDS.messageResponseWarningHours;
}

export function isSourcingStale(lastActivityAt: Date, now: Date = new Date()): boolean {
  return ageHours(lastActivityAt, now) >= THRESHOLDS.sourcingStaleHours;
}

/**
 * Best-effort operational signal only — not a commercial/authoritative
 * value. No OrderItem/FulfilmentItem lead-time snapshot exists in the
 * schema (unlike pricing, which is always snapshotted), so this falls
 * back to the vendor's *current* leadTimeDaysDefault, or the global
 * default threshold when the vendor hasn't set one. Documented as a known
 * limitation — a future lead-time snapshot column is the natural fix if
 * this ever needs to be authoritative rather than a staff-triage hint.
 */
export function isFulfilmentAtRisk(preparingSince: Date, vendorLeadTimeDays: number | null, now: Date = new Date()): boolean {
  const thresholdHours = vendorLeadTimeDays != null ? vendorLeadTimeDays * 24 : THRESHOLDS.fulfilmentPreparingWarningHours;
  return ageHours(preparingSince, now) >= thresholdHours;
}

export function isSourcingDeadlineAtRisk(requiredByDate: Date, now: Date = new Date()): boolean {
  const warningMs = THRESHOLDS.sourcingDeadlineWarningDays * 24 * 60 * 60 * 1000;
  return requiredByDate.getTime() - now.getTime() <= warningMs;
}

/// Custom-sourcing quote expiry isn't named in PROJECT.md as a configurable
/// SLA the way the OPS_* env vars above are, so these two constants stay
/// fixed here rather than adding an env var for a single narrow check —
/// still centralized and named, not a bare magic number inline.
const QUOTATION_EXPIRY_CRITICAL_HOURS = 6;
const QUOTATION_EXPIRY_WARNING_HOURS = 24;

export function severityForQuotationExpiry(expiresAt: Date, now: Date = new Date()): AttentionSeverity {
  const hoursRemaining = (expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000);
  if (hoursRemaining <= QUOTATION_EXPIRY_CRITICAL_HOURS) return "CRITICAL";
  if (hoursRemaining <= QUOTATION_EXPIRY_WARNING_HOURS) return "NEEDS_ATTENTION";
  return "NORMAL";
}

/** Human-readable duration — "5h 14m" / "1d 8h" — never a bare timestamp staff must mentally subtract. */
export function formatAge(since: Date, now: Date = new Date()): string {
  const totalMinutes = Math.max(0, Math.round((now.getTime() - since.getTime()) / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Mirrors the `allowedRoles` gating already enforced per-route today
 * (Messages/Operations/Logistics restricted to SUPER_ADMIN/OPS_ADMIN — see
 * app/(admin)/admin/{messages,operations}/**\/page.tsx). The dashboard must
 * never show a card/attention item/search result whose deep link a role
 * cannot actually open — this is the single source of truth both the
 * dashboard and search use to decide what to include, so it stays exactly
 * in sync with route-level enforcement rather than drifting from it.
 */
export function canAccessOperationalModules(role: AdminRole): boolean {
  return role === "SUPER_ADMIN" || role === "OPS_ADMIN";
}
