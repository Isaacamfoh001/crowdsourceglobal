import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/env", () => ({ env: { PAYMENT_PROVIDER: "moolre" } }));

const { getRefundExecutor } = await import("./executor");
const { moolreRefundExecutor } = await import("./moolreExecutor");

describe("getRefundExecutor — PAYMENT_PROVIDER=moolre", () => {
  it("selects MoolreRefundExecutor, never MockRefundExecutor", () => {
    const executor = getRefundExecutor();
    expect(executor).toBe(moolreRefundExecutor);
    expect(executor.name).toBe("moolre");
  });

  it("MoolreRefundExecutor fails closed — never reports success, never simulates money movement", async () => {
    const result = await getRefundExecutor().refund({ outcome: "succeed", amount: 100, currency: "GHS", paymentReference: "PAY-TEST" });
    expect(result.outcome).toBe("FAILED");
    expect(result.providerEventId).toBeNull();
    if (result.outcome === "FAILED") expect(result.manualOperationRequired).toBe(true);
  });
});
