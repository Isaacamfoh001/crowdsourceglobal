import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/env", () => ({ env: { PAYMENT_PROVIDER: "mock" } }));

const { getRefundExecutor } = await import("./executor");
const { mockRefundExecutor } = await import("./mockExecutor");

describe("getRefundExecutor — PAYMENT_PROVIDER=mock", () => {
  it("selects MockRefundExecutor", () => {
    expect(getRefundExecutor()).toBe(mockRefundExecutor);
    expect(getRefundExecutor().name).toBe("mock");
  });
});
