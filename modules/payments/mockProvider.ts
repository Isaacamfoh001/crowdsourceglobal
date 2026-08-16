import type { MockPaymentOutcome } from "./types";

/**
 * Development-only mock provider, deliberately shaped like a real one
 * (docs/architecture/overview.md's Payments row: "provider-agnostic
 * interface, implemented against Paystack first"). A real provider adapter
 * implements the same `charge` shape — nothing in modules/orders or the
 * checkout/payment pages is coupled to this being fake. No real money, no
 * card details are ever collected here.
 */
export const mockPaymentProvider = {
  name: "mock" as const,

  async charge(outcome: MockPaymentOutcome): Promise<{ succeeded: boolean; providerEventId: string }> {
    return {
      succeeded: outcome === "succeed",
      providerEventId: `mock_${crypto.randomUUID()}`,
    };
  },
};
