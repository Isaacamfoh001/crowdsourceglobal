import { describe, expect, it } from "vitest";
import { moolreRefundExecutor } from "./moolreExecutor";

describe("moolreRefundExecutor", () => {
  it("always fails closed — Moolre documents no refund API, so this must never report success", async () => {
    // The outcome argument is part of the shared RefundExecutor interface
    // (mockRefundExecutor genuinely needs it) but is meaningless here —
    // moolreRefundExecutor always fails closed regardless of what's passed.
    const result = await moolreRefundExecutor.refund("succeed");
    expect(result.succeeded).toBe(false);
    expect(result.manualOperationRequired).toBe(true);
    expect(result.reasonSafe).not.toMatch(/succeed/i);
  });
});
