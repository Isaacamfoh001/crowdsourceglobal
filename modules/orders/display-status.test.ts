import { describe, expect, it } from "vitest";
import { computeOrderDisplayStatus, type DisplayStatusCase, type DisplayStatusFulfilment } from "./display-status";

function fulfilment(overrides: Partial<DisplayStatusFulfilment> & { id: string; orderItemIds: string[] }): DisplayStatusFulfilment {
  return { status: "DELIVERED", vendorName: "Vendor", shipmentStatus: "DELIVERED", ...overrides };
}

function noCases(): DisplayStatusCase[] {
  return [];
}

/** Pure unit tests — no DB. Mirrors the M11.1 brief's §40 required scenario list. */
describe("computeOrderDisplayStatus", () => {
  it("a normal delivered single-vendor order shows DELIVERED", () => {
    const f = fulfilment({ id: "f1", orderItemIds: ["oi1"], status: "DELIVERED" });
    const result = computeOrderDisplayStatus("COMPLETED", [f], noCases());
    expect(result.overall).toBe("DELIVERED");
    expect(result.packages[0]!.status).toBe("DELIVERED");
  });

  it("delivered + an active (not yet decided) case shows ISSUE_UNDER_REVIEW, never overwriting the logistics fact underneath", () => {
    const f = fulfilment({ id: "f1", orderItemIds: ["oi1"], status: "DELIVERED" });
    const cases: DisplayStatusCase[] = [{ status: "UNDER_REVIEW", items: [{ orderItemId: "oi1", approvedResolution: null, refundStatus: null }], returnStatuses: [], replacements: [] }];
    const result = computeOrderDisplayStatus("CONFIRMED", [f], cases);
    expect(result.overall).toBe("ISSUE_UNDER_REVIEW");
  });

  it("a return that hasn't reached COMPLETED shows RETURN_IN_PROGRESS", () => {
    const f = fulfilment({ id: "f1", orderItemIds: ["oi1"], status: "DELIVERED" });
    const cases: DisplayStatusCase[] = [
      { status: "RESOLUTION_APPROVED", items: [{ orderItemId: "oi1", approvedResolution: "RETURN_AND_REFUND", refundStatus: "APPROVED" }], returnStatuses: ["IN_TRANSIT"], replacements: [] },
    ];
    const result = computeOrderDisplayStatus("CONFIRMED", [f], cases);
    // Return outranks a merely-approved refund in the priority ladder.
    expect(result.overall).toBe("RETURN_IN_PROGRESS");
  });

  it("an approved/executing refund (no return required) shows REFUND_PROCESSING", () => {
    const f = fulfilment({ id: "f1", orderItemIds: ["oi1"], status: "DELIVERED" });
    const cases: DisplayStatusCase[] = [
      { status: "RESOLUTION_APPROVED", items: [{ orderItemId: "oi1", approvedResolution: "FULL_REFUND", refundStatus: "PROCESSING" }], returnStatuses: [], replacements: [] },
    ];
    const result = computeOrderDisplayStatus("CONFIRMED", [f], cases);
    expect(result.overall).toBe("REFUND_PROCESSING");
  });

  it("all affected lines fully refunded (COMPLETED) shows REFUNDED", () => {
    const f = fulfilment({ id: "f1", orderItemIds: ["oi1"], status: "DELIVERED" });
    const cases: DisplayStatusCase[] = [
      { status: "CLOSED", items: [{ orderItemId: "oi1", approvedResolution: "FULL_REFUND", refundStatus: "COMPLETED" }], returnStatuses: [], replacements: [] },
    ];
    const result = computeOrderDisplayStatus("CONFIRMED", [f], cases);
    expect(result.overall).toBe("REFUNDED");
    expect(result.packages[0]!.status).toBe("REFUNDED");
  });

  it("only some lines of a package refunded shows PARTIALLY_REFUNDED for that package", () => {
    const f = fulfilment({ id: "f1", orderItemIds: ["oi1", "oi2"], status: "DELIVERED" });
    const cases: DisplayStatusCase[] = [
      { status: "CLOSED", items: [{ orderItemId: "oi1", approvedResolution: "FULL_REFUND", refundStatus: "COMPLETED" }], returnStatuses: [], replacements: [] },
    ];
    const result = computeOrderDisplayStatus("CONFIRMED", [f], cases);
    expect(result.overall).toBe("PARTIALLY_REFUNDED");
  });

  it("a replacement not yet delivered shows REPLACEMENT_IN_PROGRESS", () => {
    const f = fulfilment({ id: "f1", orderItemIds: ["oi1"], status: "DELIVERED" });
    const cases: DisplayStatusCase[] = [
      {
        status: "RESOLUTION_APPROVED",
        items: [{ orderItemId: "oi1", approvedResolution: "REPLACEMENT", refundStatus: null }],
        returnStatuses: [],
        replacements: [{ originalOrderItemId: "oi1", replacementFulfilmentStatus: "PREPARING" }],
      },
    ];
    const result = computeOrderDisplayStatus("CONFIRMED", [f], cases);
    expect(result.overall).toBe("REPLACEMENT_IN_PROGRESS");
  });

  it("a replacement that HAS been delivered no longer shows REPLACEMENT_IN_PROGRESS once the case is closed", () => {
    const f = fulfilment({ id: "f1", orderItemIds: ["oi1"], status: "DELIVERED" });
    const cases: DisplayStatusCase[] = [
      {
        status: "RESOLVED",
        items: [{ orderItemId: "oi1", approvedResolution: "REPLACEMENT", refundStatus: null }],
        returnStatuses: [],
        replacements: [{ originalOrderItemId: "oi1", replacementFulfilmentStatus: "DELIVERED" }],
      },
    ];
    const result = computeOrderDisplayStatus("CONFIRMED", [f], cases);
    expect(result.overall).toBe("DELIVERED"); // falls back to the plain logistics fact
  });

  it("multi-vendor: one package delivered, one fully refunded — overall PARTIALLY_REFUNDED, package detail preserved", () => {
    const vendorA = fulfilment({ id: "fA", orderItemIds: ["oiA"], vendorName: "Vendor A", status: "DELIVERED" });
    const vendorB = fulfilment({ id: "fB", orderItemIds: ["oiB"], vendorName: "Vendor B", status: "DELIVERED" });
    const cases: DisplayStatusCase[] = [
      { status: "CLOSED", items: [{ orderItemId: "oiB", approvedResolution: "FULL_REFUND", refundStatus: "COMPLETED" }], returnStatuses: [], replacements: [] },
    ];
    const result = computeOrderDisplayStatus("CONFIRMED", [vendorA, vendorB], cases);
    expect(result.overall).toBe("PARTIALLY_REFUNDED");
    expect(result.packages.find((p) => p.fulfilmentId === "fA")!.status).toBe("DELIVERED"); // Vendor A completely unaffected
    expect(result.packages.find((p) => p.fulfilmentId === "fB")!.status).toBe("REFUNDED");
  });

  it("multi-vendor: one package delivered, one with a replacement in progress — overall REPLACEMENT_IN_PROGRESS", () => {
    const vendorA = fulfilment({ id: "fA", orderItemIds: ["oiA"], vendorName: "Vendor A", status: "DELIVERED" });
    const vendorB = fulfilment({ id: "fB", orderItemIds: ["oiB"], vendorName: "Vendor B", status: "DELIVERED" });
    const cases: DisplayStatusCase[] = [
      {
        status: "RESOLUTION_APPROVED",
        items: [{ orderItemId: "oiB", approvedResolution: "REPLACEMENT", refundStatus: null }],
        returnStatuses: [],
        replacements: [{ originalOrderItemId: "oiB", replacementFulfilmentStatus: "PREPARING" }],
      },
    ];
    const result = computeOrderDisplayStatus("CONFIRMED", [vendorA, vendorB], cases);
    expect(result.overall).toBe("REPLACEMENT_IN_PROGRESS");
  });

  it("logistics history is never overwritten — a delivered Fulfilment stays reported as DELIVERED underneath a REFUNDED display", () => {
    const f = fulfilment({ id: "f1", orderItemIds: ["oi1"], status: "DELIVERED" }); // Fulfilment.status itself never changes to a financial state
    const cases: DisplayStatusCase[] = [
      { status: "CLOSED", items: [{ orderItemId: "oi1", approvedResolution: "RETURN_AND_REFUND", refundStatus: "COMPLETED" }], returnStatuses: ["COMPLETED"], replacements: [] },
    ];
    const result = computeOrderDisplayStatus("CONFIRMED", [f], cases);
    expect(result.overall).toBe("REFUNDED");
    expect(f.status).toBe("DELIVERED"); // the raw input fact is untouched by the derivation
  });

  it("no Fulfilments yet and Order still PENDING_PAYMENT shows ORDER_CONFIRMED as the safe baseline", () => {
    const result = computeOrderDisplayStatus("PENDING_PAYMENT", [], noCases());
    expect(result.overall).toBe("ORDER_CONFIRMED");
  });

  it("no Fulfilments and Order CANCELLED (pre-fulfilment cancellation) shows CANCELLED", () => {
    const result = computeOrderDisplayStatus("CANCELLED", [], noCases());
    expect(result.overall).toBe("CANCELLED");
  });

  it("a package still PREPARING while another is DELIVERED keeps the whole Order at the least-advanced stage", () => {
    const vendorA = fulfilment({ id: "fA", orderItemIds: ["oiA"], status: "DELIVERED" });
    const vendorB = fulfilment({ id: "fB", orderItemIds: ["oiB"], status: "PREPARING", shipmentStatus: null });
    const result = computeOrderDisplayStatus("CONFIRMED", [vendorA, vendorB], noCases());
    expect(result.overall).toBe("PREPARING");
  });
});
