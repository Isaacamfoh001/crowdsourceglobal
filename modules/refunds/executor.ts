import { env } from "../../lib/env";
import { mockRefundExecutor } from "./mockExecutor";
import { moolreRefundExecutor } from "./moolreExecutor";
import { paystackRefundExecutor } from "./paystackExecutor";
import type { MockRefundOutcome } from "./types";

export type RefundExecutionContext = {
  /** Dev/mock-only hint — the outcome staff explicitly chose in the mock UI. Ignored by real executors. */
  outcome: MockRefundOutcome;
  /** Server-approved amount (M9's decision, never client input). */
  amount: number;
  currency: string;
  /** The original Payment's own reference — Paystack's Refund API accepts "transaction reference or id" directly. Null if no Payment is linked (see resolutionsRepository.findRefundForExecution). */
  paymentReference: string | null;
};

/**
 * Real refund providers are asynchronous (Paystack: "Refund has been
 * queued for processing" — see docs/decisions/0007) — a refund must never
 * be marked COMPLETED merely because the create-refund request was
 * accepted. PENDING means "provider accepted the request; resolve later
 * via reconciliation/webhook", distinct from both a synchronous mock
 * success and a definitive failure.
 */
export type RefundExecutionResult =
  | { outcome: "COMPLETED"; providerEventId: string | null }
  | { outcome: "PENDING"; providerEventId: string | null }
  | { outcome: "FAILED"; providerEventId: string | null; manualOperationRequired?: boolean; reasonSafe?: string };

export interface RefundExecutor {
  readonly name: "mock" | "moolre" | "paystack";
  refund(context: RefundExecutionContext): Promise<RefundExecutionResult>;
}

/**
 * Env-based default — used only as a fallback when a Refund has no linked
 * Payment to derive a provider from (see getRefundExecutorForPaymentProvider
 * below, which is what resolutionsService.processRefund actually uses for
 * the common case). Tests must NOT rely on this function reading ambient
 * environment state — inject a specific executor via
 * resolutionsService.processRefund's `executorOverride` parameter instead.
 * Coupling test behavior to this function's env read once broke the M9
 * refund test suite; that fragility must never come back.
 */
export function getRefundExecutor(): RefundExecutor {
  if (env.PAYMENT_PROVIDER === "moolre") return moolreRefundExecutor;
  if (env.PAYMENT_PROVIDER === "paystack") return paystackRefundExecutor;
  return mockRefundExecutor;
}

/**
 * The correct selection for a real refund: use whichever provider actually
 * processed the ORIGINAL Payment, never today's globally-active default. A
 * customer may have paid weeks ago via a provider CrownSourceGlobal has
 * since stopped routing new payments to.
 */
export function getRefundExecutorForPaymentProvider(provider: "MOCK" | "MOOLRE" | "PAYSTACK" | null): RefundExecutor {
  switch (provider) {
    case "PAYSTACK":
      return paystackRefundExecutor;
    case "MOOLRE":
      return moolreRefundExecutor;
    case "MOCK":
      return mockRefundExecutor;
    default:
      return getRefundExecutor();
  }
}
