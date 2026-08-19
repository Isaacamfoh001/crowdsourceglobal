# ADR 0009: Vendor Earnings, Settlement & Manual Payout Recording (M11)

## Context

M9 built the customer-side half of post-purchase financial correctness (refunds, adjustments-in-waiting via `payoutHold`). M10A–M10B built customer payment collection. Neither ever answered the other half of the marketplace's financial lifecycle: what CrownSourceGlobal actually owes each Vendor, when that becomes payable, how it's batched, and how a payout is recorded — the mechanism ADR 0005 designed (hold + adjustment) but never built, since nothing had been paid out yet.

M11 implements that mechanism, in manual-payout mode only: no Paystack/Hubtel/Moolre transfer API is called anywhere in this milestone.

## Authoritative Payable Basis

No new pricing model. `VendorEarning.originalPayableAmount` is copied once, verbatim, from `FulfilmentItem.vendorPayableBasis` — itself already copied from `OrderItem.vendorPayableBasis`, itself snapshotted from `VendorCostRule` at checkout. This is the same "immutable financial snapshot" chain the whole system has used since M2; M11 adds a fourth stop, never a fifth pricing derivation. A later change to a Vendor's listing price or `VendorCostRule` never touches an already-created `VendorEarning`.

## The Earning Unit and Why It's the FulfilmentItem, Not the Order or OrderItem

A `VendorEarning` is created 1:1 with a `FulfilmentItem` — the smallest already-vendor-scoped, already-quantity-correct unit in the schema. This was chosen over the Order (too coarse — a multi-vendor Order must not produce one indivisible payable) and over the OrderItem (an OrderItem can, in principle, split across multiple FulfilmentItems — partial fulfilment — and only the FulfilmentItem carries the actual quantity a given Fulfilment is responsible for). One consequence: a multi-vendor Order produces exactly as many `VendorEarning` rows as it has FulfilmentItems, each independently holdable, independently settleable, and — critically — a hold or adjustment on one Vendor's earning has zero code path that could touch another Vendor's earning on the same Order. Proven directly by a test asserting Vendor B's earning is untouched when Vendor A's earning is held/adjusted in the same multi-vendor `ResolutionCase`.

## Why `FulfilmentItem.payoutEligibility` Was Removed, Not Reused

The `PayoutEligibility` enum (`NOT_ELIGIBLE|ELIGIBLE|ON_HOLD|CLAIMED`) existed on `FulfilmentItem` since the pre-implementation architecture-planning pass but had **zero real usages anywhere in the codebase** — never read, never transitioned. Reusing it would have meant either building M11's richer lifecycle (categorized holds, `heldAt`/`releasedAt`, settlement linkage, `eligibleAt`) around a 4-value enum never designed for that, or maintaining two parallel, easily-desynchronized status fields. It was removed (a clean, safe deletion — confirmed via a full-repo grep before removal) and superseded entirely by `VendorEarning.status`. `FulfilmentItem.payoutHold`/`payoutHoldReason` — which M9 *does* actively set — were left completely untouched; M11 reads them as one input alongside its own hold state, rather than migrating M9's code.

## Earning Lifecycle

`PENDING → ON_HOLD ⇄ PENDING → ELIGIBLE → INCLUDED_IN_SETTLEMENT → PAID`, plus `CANCELLED`. See `docs/domain/state-machines.md` for the full transition/trigger table. Two points worth calling out:

- **Creation timing is deterministic, not reconstructed.** A `VendorEarning` is created in the exact same transaction as its `FulfilmentItem` — `ordersService.confirmOrderPayment` (the standard/multi-vendor path) and `resolutionsRepository.createReplacementFulfilmentTransactional` (the M9 replacement path, always zero-value — see "Replacements" below). There is no batch job that later reconstructs earnings from history.
- **Customer payment success never implies Vendor payability.** `confirmOrderPayment` creates the earning as `PENDING`, never `ELIGIBLE`. The only path from `PENDING` to `ELIGIBLE` is the time-based sweep described next.

## Settlement Eligibility Policy — Centralized, and the DELIVERED-vs-COMPLETED Question Resolved

All eligibility logic lives in one place: `vendorFinanceService.sweepEligibleEarnings()`, run periodically via `scripts/sweep-earnings-eligibility.ts` (`npm run jobs:sweep-earnings`) — same DB-backed-polling-worker architecture as `sweep-abandoned-payments.ts`/`process-email-jobs.ts`, no message broker. A `PENDING` earning becomes `ELIGIBLE` when its Fulfilment's most recent Shipment has been `DELIVERED` for at least `VENDOR_PAYOUT_HOLD_HOURS` (env-configurable, default 72h, explicitly documented as an operational buffer for post-delivery issues to surface — **not** a contractual SLA; settable to `0` for testing).

This resolves a question ADR 0005/Workflow J left open since the pre-implementation planning pass ("payout eligibility trigger: COMPLETED vs. DELIVERED"): a full repo search confirms **no code anywhere transitions `Fulfilment.status` to `COMPLETED`** — `fulfilmentRepository.progressShipment` stops at `DELIVERED`, and `confirmCustomerReceipt` only records `Shipment.customerConfirmedReceiptAt`, never touching `Fulfilment.status`. This is a pre-existing M4/M5 gap, out of scope for M11 to fix (fixing it would be scope creep into fulfilment-tracking territory this milestone doesn't own). `DELIVERED` was therefore the only trigger that could actually be observed, and is used as-is.

`ON_HOLD` earnings are never touched by the sweep — they only leave `ON_HOLD` via an explicit release (`resolutionsService.resolveCase()`), never a timer.

## Refund/Adjustment Integration with M9 — Where the Wiring Actually Lives

Rather than exposing a cross-module transactional call from `resolutionsService` into `vendorFinanceService` (which would require a new "pass the ambient `tx` across module boundaries" pattern this codebase doesn't otherwise use), the hold/adjustment writes are inlined directly into `resolutionsRepository.approveResolutionTransactional`'s existing single transaction — the same pattern `ordersService.confirmOrderPayment` already established for touching Payment/Fulfilment/FulfilmentItem/Shipment/InventoryReservation atomically in one business event. `resolutionsRepository.ts` imports `vendorFinanceRepository`'s small `*Tx` helper functions (`applyResolutionHoldTx`, `createResolutionAdjustmentTx`, `cancelEarningsForFulfilmentTx`), which accept the ambient `tx` client. `resolutionsService.resolveCase()` (a genuinely separate, later event) calls `vendorFinanceService.releaseHoldForResolutionCase(caseId)` as an ordinary, non-transactional service-to-service call, exactly like it already calls `notificationsService`.

**Responsibility, not issue type, decides.** `ResolutionCase.responsibility` (`VENDOR|CROWNSOURCE|LOGISTICS|CUSTOMER|EXTERNAL_SUPPLIER|SHARED_OTHER`) is an explicit staff judgment call, never inferred from `issueType` — this was already M9's rule; M11 only adds that `responsibility = VENDOR` is now the trigger for a real adjustment, not just a hold. A case spanning multiple vendors carries one `responsibility` value for the whole case (M9's existing model, unchanged), but the resulting adjustment is always sized to that specific `ResolutionCaseItem`'s own `approvedRefundAmount` and linked to that item's own Vendor — so a multi-vendor case with one vendor-fault line never touches the other vendor's earning.

**Post-settlement refunds are not a special case in the code.** `createResolutionAdjustmentTx` doesn't check the linked `VendorEarning`'s current status — an adjustment against an already-`PAID` earning is created exactly the same way as one against a `PENDING` one. It simply starts with `appliedToSettlementId = null` and waits to be swept into that Vendor's *next* Settlement. Proven directly by a test that pays a Vendor out via a real Settlement, then approves a `VENDOR`-responsibility partial refund on the same OrderItem, and asserts (a) the already-PAID earning is never reopened, (b) the new adjustment is unapplied, and (c) the original Settlement's `netAmount` is untouched.

## Settlement Model — One Vendor per Settlement, Manual Payout Only

`VendorSettlement`/`VendorSettlementItem` — see `docs/domain/entities.md` for full fields. Key mechanics:

- **Creation** (`vendorFinanceService.createSettlement`): admin selects a subset of one Vendor's `ELIGIBLE` earnings. The transaction claims them with a guarded `updateMany` (`status: "ELIGIBLE"` in the WHERE clause) — if the requested count doesn't match the claimed count (another settlement got there first), the whole transaction throws and rolls back, so nothing is partially created. It then sweeps **every** currently-unapplied `VendorFinancialAdjustment` for that Vendor (not just ones tied to the selected earnings) — this is what makes a negative balance from a post-settlement refund actually get collected against future earnings, per ADR 0005's "netted into the next run" design. If the resulting `netAmount` would be ≤ 0, the transaction throws and nothing is created — a Vendor with a negative balance simply cannot be settled until enough new eligible earnings accumulate.
- **`VendorSettlementItem.vendorEarningId` is `@unique`** — the DB-level guarantee that an earning can never be claimed by two Settlements, closing the "two Admins create a Settlement with the same earning" race even beyond the application-level guarded update.
- **Approval** (`DRAFT → APPROVED`): snapshots the Vendor's current `VendorPayoutDestination` into `destinationSnapshot` (unmasked — Admin needs enough detail to actually execute the payout). A later Vendor change to their payout destination never touches this snapshot — proven by a test that changes the destination after approval and asserts the historical Settlement still shows the original.
- **Cancellation** (`DRAFT`/`APPROVED → CANCELLED`): only reachable before a payout is recorded. Deletes the `VendorSettlementItem` rows (freeing the unique constraint so those earnings can be selected again) and un-applies (`appliedToSettlementId = null`) any swept adjustments — safe because nothing external has happened yet; the `VendorSettlement` row itself is kept, marked `CANCELLED`, never deleted.
- **Recording a payout** (`APPROVED → PAID`, `vendorFinanceService.recordPayout`): requires `method`/`externalReference`/`paidAt` — this is explicitly a record of money CrownSourceGlobal already sent externally (bank transfer or Mobile Money, operationally, outside this system), never a "Pay Vendor" button that pretends to move money. Guarded `updateMany` (`status: "APPROVED"`) makes a double-click record at most once. On success, every included earning moves to `PAID` in the same transaction.
- **Correcting a wrongly-recorded payout**: never edits the original amount/reference/`paidAt` (no deletion of financial history). `reverseSettlementTransactional` sets `reversedAt`/`reversedByUserId`/`reversalReason` (additive markers — the settlement stays visibly `PAID`, now flagged reversed) and creates one negative `SETTLEMENT_REVERSAL` `VendorFinancialAdjustment` per included earning, which nets into that Vendor's *next* Settlement — the exact same mechanism as a post-settlement refund, deliberately reused rather than inventing a second correction path.

## Manual Payout Only — What's Explicitly Deferred

No call to Paystack's Transfer API, Hubtel's disbursement API, or Moolre's payout API exists anywhere in `modules/vendor-finance`. `PayoutMethod` (`BANK_TRANSFER|MOBILE_MONEY|OTHER`) records what CrownSourceGlobal actually used externally — a label, not an integration. Automated disbursement is a distinct future milestone that will compare providers and connect a real adapter once this financial semantics layer has passed manual acceptance — the same staged approach M10A/M10A.2 took for customer payment collection (mock → real provider, never the reverse).

## Payout Destination — OWNER-Only, Masked for the Vendor, Snapshotted per Settlement

`VendorPayoutDestination` is a new, separate model — never reusing `Vendor`'s private pickup/contact fields, which describe a different thing (where CrownSource-arranged collection happens, not where money should be sent). Mutation is gated to `VendorMembershipRole.OWNER` in `vendorFinanceService.upsertPayoutDestinationForVendor` — the first real use of the OWNER/STAFF distinction that has existed, unused, on `VendorMembership` since M3. The Vendor Portal always displays a masked phone/account number (`maskGhanaPhone`, a local last-4 masking helper for bank numbers); the Admin Finance area and `VendorSettlement.destinationSnapshot` show the real value, since Admin genuinely needs it to execute the payout.

## Negative Balance — Derived, Never a Single Mutable Field

There is no `vendor.balance` column. "Outstanding balance" is always computed on read: `sum(ELIGIBLE earnings) + sum(unapplied adjustments)`, shown on both the Vendor Finance overview and the Admin Vendor Finance detail page. A negative balance is visible (e.g., "Available: GH₵0, Outstanding adjustment: -GH₵170") but never lets a Settlement be created with a non-positive net — see "Settlement Model" above. This satisfies the brief's explicit "do not maintain one mutable balance field" instruction while still giving both Vendor and Admin a clear, correct number.

## Replacements — Never Paid Twice, Automatically

A replacement Fulfilment (`resolutionsRepository.createReplacementFulfilmentTransactional`) creates its `VendorEarning` the same way as the standard path, but its `OrderItem.vendorPayableBasis` (and therefore `FulfilmentItem.vendorPayableBasis` and `VendorEarning.originalPayableAmount`) is always `0` — the Replacement model's pre-existing invariant ("never a fake customer charge"). No special-casing was needed: applying the identical earning-creation rule uniformly means a replacement never silently creates additional payable. If CrownSourceGlobal ever wants to authorize an extra payment for a replacement, that's an explicit admin `MANUAL_CORRECTION` adjustment — never inferred.

## External Suppliers — Explicitly Out of Scope

M6 custom sourcing may use external suppliers that are not modeled as `Vendor` entities. Vendor Finance handles real `Vendor` rows only; external-supplier settlement remains an Admin/manual sourcing-cost operation outside this domain, unless/until a future decision models them as a distinct financeable party.

## Roles

`FINANCE_ADMIN` (modeled since M3, unused until now) and `SUPER_ADMIN` can mutate (create/approve/cancel a Settlement, record a payout, create a manual correction). `OPS_ADMIN` can view the Admin Finance area (read-only) — mirroring `canAccessFinance()`'s existing gate for `/admin/payments`, not a new capability invented for this milestone. Four-eyes approval (a Settlement's creator cannot also approve it) was evaluated and deliberately **not** built for V1 — the current team size makes it impractical, and nothing about the mechanism prevents adding it later as a pure authorization check on `approveSettlement`. Documented here as a future control, not silently dropped.

## Consequences

- No automated Vendor transfer exists yet — this milestone is explicitly a financial-correctness layer, not a payments-out integration.
- `VendorEarning`/`VendorFinancialAdjustment`/`VendorSettlement` join the small set of models this codebase treats as append-only/additive-only financial history (alongside `Payment`, `Refund`) — corrections are always new rows, never in-place edits of an already-recorded amount.
- The `DELIVERED`-vs-`COMPLETED` ambiguity ADR 0005 left open is now resolved by necessity, not by a fresh business decision — a future milestone that finally implements `Fulfilment → COMPLETED` should revisit whether eligibility should shift to that trigger instead.
