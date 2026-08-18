import { env } from "../../lib/env";
import { moolrePaymentProvider } from "./providers/moolre/adapter";
import { paystackPaymentProvider } from "./providers/paystack/adapter";
import type { PaymentProvider } from "./provider";

/**
 * The single place that decides which real (async) provider is active.
 * Mock is handled entirely separately (see modules/payments/service.ts's
 * `attemptMockPayment`) — it never implements this interface, so it's not
 * a branch here. Paystack is the primary provider as of M10A.2; Moolre
 * remains selectable for development/experimental testing only (see
 * docs/decisions/0007) and is never chosen implicitly.
 */
export function getActivePaymentProvider(): PaymentProvider {
  return env.PAYMENT_PROVIDER === "moolre" ? moolrePaymentProvider : paystackPaymentProvider;
}
