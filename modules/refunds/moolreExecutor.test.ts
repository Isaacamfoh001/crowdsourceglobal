import { describe, expect, it } from "vitest";
import { moolreRefundExecutor } from "./moolreExecutor";

describe("moolreRefundExecutor", () => {
  it("always fails closed — Moolre documents no refund API, so this must never report success", async () => {
    // The context argument is part of the shared RefundExecutor interface
    // (mockRefundExecutor/paystackRefundExecutor genuinely need it) but is
    // meaningless here — moolreRefundExecutor always fails closed
    // regardless of what's passed.
    const result = await moolreRefundExecutor.refund({ outcome: "succeed", amount: 100, currency: "GHS", paymentReference: "PAY-TEST" });
    expect(result.outcome).toBe("FAILED");
    if (result.outcome === "FAILED") {
      expect(result.manualOperationRequired).toBe(true);
      expect(result.reasonSafe).not.toMatch(/succeed/i);
    }
  });
});
