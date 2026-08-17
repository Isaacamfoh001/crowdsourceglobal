import type { MockRefundOutcome } from "./types";

/**
 * Development-only mock refund executor, deliberately shaped like
 * `modules/payments/mockProvider.ts`'s `charge()` — the REFUND DECISION
 * (amount, items, approval) is owned entirely by modules/resolutions;
 * this is only the EXECUTION boundary, standing in for a future
 * `ProductionPaymentProvider.refund(...)` (M10). No real money moves here,
 * and nothing outside modules/resolutions/service.ts is coupled to this
 * being fake.
 */
export const mockRefundExecutor = {
  name: "mock" as const,

  async refund(outcome: MockRefundOutcome): Promise<{ succeeded: boolean; providerEventId: string }> {
    return {
      succeeded: outcome === "succeed",
      providerEventId: `mock_refund_${crypto.randomUUID()}`,
    };
  },
};
