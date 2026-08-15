# ADR 0005: Payout Corrections via Hold + Adjustment (Not a Full Ledger)

## Context

Vendor payout must remain correct across refunds, disputes, and cancellations that can occur before or after a payout has already run, without building a full double-entry accounting ledger CrownSourceGlobal doesn't otherwise need (CLAUDE.md §6 — avoid unnecessary infrastructure/complexity).

Cases that must be handled: refund before fulfilment; refund after fulfilment but before payout; refund after payout; partial refund; cancelled order; payout hold; payout eligibility; payout adjustment/recovery.

## Options Considered

**A. Full double-entry accounting ledger.** Every financial movement recorded as balanced debit/credit entries against vendor accounts.

**B. Payout hold flag + PayoutAdjustment records.** A boolean hold on `FulfilmentItem` preventing it from being claimed by a payout run, plus signed `PayoutAdjustment` records that net corrections into a vendor's next `PayoutRun`.

## Decision

**Option B.**

## Rationale

Every case in scope reduces to one of two mechanical needs: (1) *prevent* a not-yet-paid amount from being paid (`payoutHold`), or (2) *correct* an already-paid amount going forward (`PayoutAdjustment`, netted into the next run). Neither requires balanced double-entry bookkeeping — CrownSourceGlobal is not implementing general-purpose accounting, only tracking what it owes each vendor. Option A is real infrastructure with real ongoing complexity that nothing in the current requirements demonstrates a need for, per CLAUDE.md §6's justification pattern.

| Case | Mechanism |
|---|---|
| Refund before fulfilment | No FulfilmentItem ever reaches ELIGIBLE — nothing to hold or adjust |
| Refund after fulfilment, before payout | `payoutHold = true` on the affected FulfilmentItem(s) |
| Refund after vendor payout | Negative `PayoutAdjustment`, netted into the vendor's next PayoutRun |
| Partial refund | Reduced eligible amount pre-payout, or a proportional `PayoutAdjustment` post-payout |

Full detail: `/docs/workflows/workflows.md` Workflow K.

## Open Business Policy (Not an Engineering Gap)

Two questions are genuine business decisions this ADR does not resolve, and do not block implementation of the mechanism itself:
- Who determines a refund is "vendor-fault" (triggering a hold), vs. a no-fault customer-side refund that leaves the vendor's eligibility untouched?
- Is a post-payout adjustment always net-off-next-run, or does some threshold warrant direct reclaim from the vendor?

Until a firmer policy exists, both default to admin manual judgment — the mechanism supports that indefinitely without change.

## Consequences

- No `LedgerEntry`/double-entry tables exist in the V1 schema.
- Every payout correction is traceable to either a `payoutHold` (prevention) or a `PayoutAdjustment` (correction) row, giving full auditability without ledger complexity.
- If a genuine need for full accounting semantics (e.g., multi-currency netting, external accounting system integration) emerges later, that is a new decision to revisit this ADR against — not an assumption to make now.
