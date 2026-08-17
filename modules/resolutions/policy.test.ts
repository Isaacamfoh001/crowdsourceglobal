import { describe, expect, it } from "vitest";
import {
  classifyCancellationEligibility,
  validateRefundAmount,
  validateQuantity,
  isRefundBearing,
  requiresReturn,
  isReplacement,
  CANCELLABLE_FULFILMENT_STATUSES,
} from "./policy";

describe("resolutions policy", () => {
  describe("classifyCancellationEligibility", () => {
    it("PENDING is SAFE", () => {
      expect(classifyCancellationEligibility("PENDING")).toBe("SAFE");
    });
    it("PREPARING/READY/DISPATCHED need review", () => {
      expect(classifyCancellationEligibility("PREPARING")).toBe("NEEDS_REVIEW");
      expect(classifyCancellationEligibility("READY")).toBe("NEEDS_REVIEW");
      expect(classifyCancellationEligibility("DISPATCHED")).toBe("NEEDS_REVIEW");
    });
    it("DELIVERED/COMPLETED/CANCELLED/EXCEPTION are BLOCKED", () => {
      expect(classifyCancellationEligibility("DELIVERED")).toBe("BLOCKED");
      expect(classifyCancellationEligibility("COMPLETED")).toBe("BLOCKED");
      expect(classifyCancellationEligibility("CANCELLED")).toBe("BLOCKED");
      expect(classifyCancellationEligibility("EXCEPTION")).toBe("BLOCKED");
    });
  });

  describe("CANCELLABLE_FULFILMENT_STATUSES", () => {
    it("only covers PENDING/PREPARING/READY", () => {
      expect(CANCELLABLE_FULFILMENT_STATUSES).toEqual(["PENDING", "PREPARING", "READY"]);
    });
  });

  describe("validateRefundAmount — never trusts a client total beyond the remaining refundable value", () => {
    it("rejects zero or negative amounts", () => {
      expect(validateRefundAmount({ requestedAmount: 0, alreadyApprovedAmount: 0, lineTotal: 100 }).ok).toBe(false);
      expect(validateRefundAmount({ requestedAmount: -5, alreadyApprovedAmount: 0, lineTotal: 100 }).ok).toBe(false);
    });
    it("accepts an amount within the remaining refundable value", () => {
      expect(validateRefundAmount({ requestedAmount: 40, alreadyApprovedAmount: 0, lineTotal: 100 }).ok).toBe(true);
    });
    it("rejects an amount exceeding the line total", () => {
      const result = validateRefundAmount({ requestedAmount: 150, alreadyApprovedAmount: 0, lineTotal: 100 });
      expect(result.ok).toBe(false);
    });
    it("caps against what's already been approved elsewhere for the same item — prevents cumulative over-refund", () => {
      const result = validateRefundAmount({ requestedAmount: 60, alreadyApprovedAmount: 70, lineTotal: 100 });
      expect(result.ok).toBe(false); // 70 + 60 = 130 > 100
    });
    it("accepts exactly the remaining amount", () => {
      const result = validateRefundAmount({ requestedAmount: 30, alreadyApprovedAmount: 70, lineTotal: 100 });
      expect(result.ok).toBe(true);
    });
  });

  describe("validateQuantity — cumulative resolved quantity never exceeds the original purchase", () => {
    it("rejects zero or negative quantity", () => {
      expect(validateQuantity({ requestedQuantity: 0, alreadyResolvedQuantity: 0, purchasedQuantity: 10 }).ok).toBe(false);
    });
    it("accepts a quantity within what remains", () => {
      expect(validateQuantity({ requestedQuantity: 3, alreadyResolvedQuantity: 0, purchasedQuantity: 10 }).ok).toBe(true);
    });
    it("rejects cumulative quantity exceeding the original purchase", () => {
      const result = validateQuantity({ requestedQuantity: 5, alreadyResolvedQuantity: 7, purchasedQuantity: 10 });
      expect(result.ok).toBe(false); // 7 + 5 = 12 > 10
    });
  });

  describe("decision classification", () => {
    it("identifies refund-bearing decisions", () => {
      expect(isRefundBearing("FULL_REFUND")).toBe(true);
      expect(isRefundBearing("PARTIAL_REFUND")).toBe(true);
      expect(isRefundBearing("RETURN_AND_REFUND")).toBe(true);
      expect(isRefundBearing("REPLACEMENT")).toBe(false);
      expect(isRefundBearing("NO_ACTION")).toBe(false);
    });
    it("identifies decisions requiring a return", () => {
      expect(requiresReturn("RETURN_AND_REFUND")).toBe(true);
      expect(requiresReturn("RETURN_AND_REPLACEMENT")).toBe(true);
      expect(requiresReturn("FULL_REFUND")).toBe(false);
    });
    it("identifies replacement decisions", () => {
      expect(isReplacement("REPLACEMENT")).toBe(true);
      expect(isReplacement("RETURN_AND_REPLACEMENT")).toBe(true);
      expect(isReplacement("FULL_REFUND")).toBe(false);
    });
  });
});
