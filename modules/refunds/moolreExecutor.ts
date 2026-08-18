import type { RefundExecutor } from "./executor";

/**
 * Moolre's official documentation (sitemap fully reviewed) does not list a
 * refund/reversal endpoint anywhere under its Payments API group — only
 * initiate, payment-id, virtual-account, links, status, and webhook exist.
 * Per M10A's explicit instruction, we do NOT invent an API that isn't
 * documented. This executor always fails closed with an explicit
 * "manual operation required" outcome rather than pretending a refund
 * succeeded — MockRefundExecutor remains the only executor that can
 * actually report success, for dev/tests. If Moolre later documents a real
 * refund endpoint, this file (and only this file) needs to change.
 *
 * Selected automatically in production whenever PAYMENT_PROVIDER=moolre
 * (see modules/refunds/executor.ts's getRefundExecutor) — never invoked
 * alongside, or as a fallback from, mockRefundExecutor.
 */
export const moolreRefundExecutor: RefundExecutor = {
  name: "moolre",

  async refund(): Promise<{ succeeded: false; providerEventId: null; manualOperationRequired: true; reasonSafe: string }> {
    return {
      succeeded: false,
      providerEventId: null,
      manualOperationRequired: true,
      reasonSafe:
        "Moolre does not currently document an automated refund API. Process this refund manually with Moolre, then record the outcome.",
    };
  },
};
