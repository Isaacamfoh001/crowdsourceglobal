import type { RefundExecutionContext, RefundExecutionResult, RefundExecutor } from "./executor";

/**
 * Development-only mock refund executor, deliberately shaped like
 * `modules/payments/mockProvider.ts`'s `charge()` — the REFUND DECISION
 * (amount, items, approval) is owned entirely by modules/resolutions;
 * this is only the EXECUTION boundary. No real money moves here, and
 * nothing outside modules/resolutions/service.ts is coupled to this being
 * fake. Resolves synchronously (COMPLETED/FAILED), unlike the real
 * providers' async PENDING — an explicit, deliberate dev/test simplification.
 */
export const mockRefundExecutor: RefundExecutor = {
  name: "mock",

  async refund(context: RefundExecutionContext): Promise<RefundExecutionResult> {
    if (context.outcome === "succeed") {
      return { outcome: "COMPLETED", providerEventId: `mock_refund_${crypto.randomUUID()}` };
    }
    return { outcome: "FAILED", providerEventId: null, reasonSafe: "Simulated refund failure" };
  },
};
