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
    const result = await getRefundExecutor().refund("succeed");
    expect(result.succeeded).toBe(false);
    expect(result.manualOperationRequired).toBe(true);
    expect(result.providerEventId).toBeNull();
  });
});
