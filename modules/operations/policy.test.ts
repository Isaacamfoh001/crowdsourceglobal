import { describe, expect, it } from "vitest";
import {
  ageHours,
  canAccessOperationalModules,
  formatAge,
  isConversationOverdue,
  isFulfilmentAtRisk,
  isListingReviewStale,
  isSourcingDeadlineAtRisk,
  isSourcingStale,
  isVendorApplicationStale,
  severityForAge,
  severityForQuotationExpiry,
  THRESHOLDS,
} from "./policy";

const HOUR = 60 * 60 * 1000;
const hoursAgo = (h: number, now: Date) => new Date(now.getTime() - h * HOUR);

describe("operations policy", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  describe("severityForAge — threshold boundary behavior", () => {
    it("is NORMAL just under the threshold", () => {
      expect(severityForAge(9.99, 10)).toBe("NORMAL");
    });
    it("is NEEDS_ATTENTION exactly at the threshold", () => {
      expect(severityForAge(10, 10)).toBe("NEEDS_ATTENTION");
    });
    it("is NEEDS_ATTENTION just under 2x the threshold", () => {
      expect(severityForAge(19.99, 10)).toBe("NEEDS_ATTENTION");
    });
    it("escalates to CRITICAL at exactly 2x the threshold", () => {
      expect(severityForAge(20, 10)).toBe("CRITICAL");
    });
    it("stays CRITICAL well beyond 2x", () => {
      expect(severityForAge(1000, 10)).toBe("CRITICAL");
    });
  });

  describe("severityForQuotationExpiry", () => {
    it("is NORMAL well before expiry", () => {
      expect(severityForQuotationExpiry(new Date(now.getTime() + 48 * HOUR), now)).toBe("NORMAL");
    });
    it("is NEEDS_ATTENTION within the 24h warning window", () => {
      expect(severityForQuotationExpiry(new Date(now.getTime() + 20 * HOUR), now)).toBe("NEEDS_ATTENTION");
    });
    it("is CRITICAL within 6h of expiry", () => {
      expect(severityForQuotationExpiry(new Date(now.getTime() + 3 * HOUR), now)).toBe("CRITICAL");
    });
  });

  describe("ageing predicates use the configured thresholds", () => {
    it("a fresh vendor application is not stale", () => {
      expect(isVendorApplicationStale(hoursAgo(1, now), now)).toBe(false);
    });
    it("a vendor application past the warning threshold is stale", () => {
      expect(isVendorApplicationStale(hoursAgo(THRESHOLDS.vendorApplicationWarningHours + 1, now), now)).toBe(true);
    });

    it("a fresh listing review is not stale", () => {
      expect(isListingReviewStale(hoursAgo(1, now), now)).toBe(false);
    });
    it("a listing review past the warning threshold is stale", () => {
      expect(isListingReviewStale(hoursAgo(THRESHOLDS.listingReviewWarningHours + 1, now), now)).toBe(true);
    });

    it("a conversation replied to recently is not overdue", () => {
      expect(isConversationOverdue(hoursAgo(0.1, now), now)).toBe(false);
    });
    it("a conversation past the message-response threshold is overdue", () => {
      expect(isConversationOverdue(hoursAgo(THRESHOLDS.messageResponseWarningHours + 1, now), now)).toBe(true);
    });

    it("a sourcing request with recent activity is not stale", () => {
      expect(isSourcingStale(hoursAgo(1, now), now)).toBe(false);
    });
    it("a sourcing request with no activity past the threshold is stale", () => {
      expect(isSourcingStale(hoursAgo(THRESHOLDS.sourcingStaleHours + 1, now), now)).toBe(true);
    });

    it("a deadline well in the future is not at risk", () => {
      expect(isSourcingDeadlineAtRisk(new Date(now.getTime() + 10 * 24 * HOUR), now)).toBe(false);
    });
    it("a deadline within the configured warning window is at risk", () => {
      expect(isSourcingDeadlineAtRisk(new Date(now.getTime() + (THRESHOLDS.sourcingDeadlineWarningDays - 0.5) * 24 * HOUR), now)).toBe(true);
    });
    it("an already-passed deadline is at risk", () => {
      expect(isSourcingDeadlineAtRisk(hoursAgo(1, now), now)).toBe(true);
    });
  });

  describe("isFulfilmentAtRisk — lead-time-aware, per M8 spec", () => {
    it("uses the vendor's own lead time when set, not the global default", () => {
      // Vendor promises 1 day (24h); 20h in is still within that window.
      expect(isFulfilmentAtRisk(hoursAgo(20, now), 1, now)).toBe(false);
      expect(isFulfilmentAtRisk(hoursAgo(30, now), 1, now)).toBe(true);
    });
    it("falls back to the global default when the vendor has no lead time set", () => {
      expect(isFulfilmentAtRisk(hoursAgo(THRESHOLDS.fulfilmentPreparingWarningHours - 1, now), null, now)).toBe(false);
      expect(isFulfilmentAtRisk(hoursAgo(THRESHOLDS.fulfilmentPreparingWarningHours + 1, now), null, now)).toBe(true);
    });
  });

  describe("formatAge — human-readable duration", () => {
    it("renders minutes only under an hour", () => {
      expect(formatAge(new Date(now.getTime() - 37 * 60_000), now)).toBe("37m");
    });
    it("renders hours and minutes under a day", () => {
      expect(formatAge(hoursAgo(5.5, now), now)).toBe("5h 30m");
    });
    it("renders days and hours beyond a day", () => {
      expect(formatAge(hoursAgo(32, now), now)).toBe("1d 8h");
    });
  });

  describe("ageHours", () => {
    it("computes elapsed hours between two dates", () => {
      expect(ageHours(hoursAgo(3, now), now)).toBeCloseTo(3, 5);
    });
  });

  describe("canAccessOperationalModules — mirrors existing route-level allowedRoles gating exactly", () => {
    it("SUPER_ADMIN can access operational modules", () => {
      expect(canAccessOperationalModules("SUPER_ADMIN")).toBe(true);
    });
    it("OPS_ADMIN can access operational modules", () => {
      expect(canAccessOperationalModules("OPS_ADMIN")).toBe(true);
    });
    it("FINANCE_ADMIN cannot access operational modules", () => {
      expect(canAccessOperationalModules("FINANCE_ADMIN")).toBe(false);
    });
  });
});
