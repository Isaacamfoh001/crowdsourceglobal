import type { RefundExecutionResult, RefundExecutor } from "./executor";

/**
 * Moolre's official documentation (sitemap fully reviewed) does not list a
 * refund/reversal endpoint anywhere under its Payments API group — only
 * initiate, payment-id, virtual-account, links, status, and webhook exist.
 * Per M10A's explicit instruction, we do NOT invent an API that isn't
 * documented. This executor always fails closed with an explicit
 * "manual operation required" outcome rather than pretending a refund
 * succeeded — MockRefundExecutor remains the only executor that can
 * actually report success, for dev/tests. Moolre is experimental/deferred
 * as of M10A.2 (docs/decisions/0007); this stays unchanged regardless.
 */
export const moolreRefundExecutor: RefundExecutor = {
  name: "moolre",

  async refund(): Promise<RefundExecutionResult> {
    return {
      outcome: "FAILED",
      providerEventId: null,
      manualOperationRequired: true,
      reasonSafe:
        "Moolre does not currently document an automated refund API. Process this refund manually with Moolre, then record the outcome.",
    };
  },
};
