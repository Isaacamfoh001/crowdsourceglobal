import { env } from "../../lib/env";
import { mockRefundExecutor } from "./mockExecutor";
import { moolreRefundExecutor } from "./moolreExecutor";
import type { MockRefundOutcome } from "./types";

export type RefundExecutionResult = {
  succeeded: boolean;
  providerEventId: string | null;
  /** Present only on a real-provider executor that has no documented way to actually execute a refund. */
  manualOperationRequired?: boolean;
  /** Customer/staff-safe failure copy — used in place of the generic "Simulated refund failure" message when present. */
  reasonSafe?: string;
};

export interface RefundExecutor {
  readonly name: "mock" | "moolre";
  refund(outcome: MockRefundOutcome): Promise<RefundExecutionResult>;
}

/**
 * Provider-aware selection — production must NEVER silently fall back to
 * the mock executor just because it's simpler. `mockRefundExecutor` can
 * genuinely report a completed refund; `moolreRefundExecutor` always fails
 * closed (Moolre documents no refund API — see docs/decisions/0006).
 *
 * Tests must NOT rely on this function reading ambient environment state —
 * inject a specific executor via `resolutionsService.processRefund`'s
 * `executorOverride` parameter instead. Coupling test behavior to this
 * function's env read once broke the M9 refund test suite the moment a
 * developer's local `.env` had `PAYMENT_PROVIDER=moolre` set for real
 * sandbox collection testing; that fragility must never come back.
 */
export function getRefundExecutor(): RefundExecutor {
  return env.PAYMENT_PROVIDER === "moolre" ? moolreRefundExecutor : mockRefundExecutor;
}
