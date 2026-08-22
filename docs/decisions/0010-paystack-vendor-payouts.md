# ADR 0010: Automated Vendor Payouts via Paystack Transfers (M12)

## Context

ADR 0009/M11 built the full Vendor-payable financial-correctness layer (`VendorEarning`, `VendorFinancialAdjustment`, `VendorSettlement`) but stopped at manual payout: `recordPayout` only ever recorded that money had already been sent externally — no call to a real disbursement API existed anywhere in `modules/vendor-finance`. M12 closes exactly that remaining gap: when a `VendorSettlement` is `APPROVED`, Admin can click **Send Payout** and CrownSourceGlobal sends a real Paystack Transfer to the Vendor's saved destination, tracks the provider's own confirmation, and only a provider-confirmed success ever becomes `PAID`.

## What Paystack's Transfer API Actually Requires (sourced, not assumed)

Paystack's `paystack.com/docs/*` host 403s automated fetches (the same limitation ADR 0007 already hit); the facts below come from Paystack's own reference pages reachable through search/mirrors and are treated with the same "sourced, flagged if uncertain" discipline as ADR 0007's Mobile Money provider codes.

- **Transfer Recipients** (`POST /transferrecipient`) — `type` is one of `nuban | ghipss | mobile_money | basa`; for Ghana, `ghipss` is a bank account, `mobile_money` a telco wallet. Both require `name`, `account_number`, `bank_code`, `currency`.
- **`bank_code` is a DIFFERENT code space from the Charge API's `mobile_money.provider` field.** The Charge API (ADR 0007, customer payments) uses short strings (`mtn`/`atl`/`vod`). The Transfer Recipient API instead treats each Ghana Mobile Money telco as an entry in `GET /bank?country=ghana&currency=GHS&type=mobile_money`, identified by `bank_code` — a value that must be looked up, never hardcoded as if it were the same string. Bank transfers resolve the same way against `GET /bank?...&type=ghipss`. Confusing the two code spaces would have been exactly the kind of invented-provider-behavior this milestone's brief explicitly forbade.
- **Initiating a transfer** (`POST /transfer`) — `source: "balance"`, `amount` (pesewas for GHS, same minor-unit convention as ADR 0007's payment amounts), `recipient` (a `recipient_code`), `reason`, `currency`, and a caller-supplied `reference` (recommended specifically to make retries/reconciliation safe — "you can retry a non-conclusive transfer rather than initiate a new request"). Response `data.status` is `pending` (OTP disabled — the normal case), `otp` (the Paystack account has the Transfers OTP requirement enabled), or a value that resolves later via webhook/verify to `success`/`failed`/`reversed`.
- **Verify Transfer** (`GET /transfer/verify/:reference`) — independently re-checks status by CrownSourceGlobal's own reference, mirroring `GET /transaction/verify/:reference`'s role on the payment side.
- **Webhooks** — `transfer.success`, `transfer.failed`, `transfer.reversed`, delivered to the same webhook URL as `charge.*`/`refund.*` events, same envelope shape (`event`, `data`).

## Decision

**A small provider-neutral `PayoutProvider` interface** (`modules/vendor-finance/payout-provider.ts`: `resolveRecipient` / `initiate` / `verify`), with `paystackPayoutProvider` (`modules/vendor-finance/paystack-payout-provider.ts`) as the only V1 implementation — the same shape `RefundExecutor` already established for refunds (ADR 0007) and `PaymentProvider` for payments (ADR 0006/0007). This is deliberately the smallest contract that lets `vendorFinanceService`'s settlement logic stay provider-agnostic; a future Hubtel adapter would implement this interface, never touch settlement logic. No generic payments framework, no Hubtel implementation, per the brief's explicit scope limit.

**Bank code resolution is dynamic, not hardcoded**, via `modules/payments/providers/paystack/bank-codes.ts`: `GET /bank` is fetched (and cached in-memory, 1-hour TTL, no Redis — CLAUDE.md §17) and matched by name — Mobile Money network (`MTN`/`TELECEL`/`AT`) by a small fixed keyword list, bank name (free text on `VendorPayoutDestination.bankName`) by normalized exact/substring match. An unmatched bank name fails closed with an Admin-actionable message rather than guessing a `bank_code` — a wrong `bank_code` risks a rejected transfer at Paystack's own KYC/name-match step, which is a safe failure mode (Admin sees "Payout failed" and can correct the Vendor's details), never a misdirected payment (the `account_number` is what actually receives funds).

## Settlement Lifecycle — Two New States, Not a State-Machine-Looking Console

`SettlementStatus` gains exactly two values: `PROCESSING` (a real transfer is in flight, outcome not yet confirmed) and `FAILED` (Paystack gave a definitive negative answer). Full lifecycle:

```
DRAFT -> APPROVED -> PROCESSING -> PAID
                            \-> FAILED -> PROCESSING (retry) -> PAID/FAILED
DRAFT/APPROVED/FAILED -> CANCELLED (manual-payout fallback remains available from here)
APPROVED -> PAID  (manual "Record External Payout" — unchanged from M11, still available when Paystack isn't the active provider or Admin chooses the fallback)
```

No `QUEUED`/`SUBMITTED`/`PROVIDER_ACKNOWLEDGED`/etc. — every Paystack-side nuance (`pending`, `queued`, network timeout) collapses to the single business-meaningful `PROCESSING` state; only a genuinely terminal provider answer (`success`, `failed`, `reversed`, or the `otp`-misconfiguration case) ever leaves it. The UI (`components/admin/SettlementActions.tsx`) renders exactly one primary action per status — never Approve/Send/Retry/Check-status simultaneously.

## Manual and Automated Payout Cannot Conflict — By Construction, Not a New Flag

Both `recordPayoutTransactional` (manual) and `claimSettlementForPayout` (automated) are guarded `updateMany`s keyed on the settlement's own current `status`: manual recording requires `status = "APPROVED"` (unchanged since M11); automated claiming requires `status IN ("APPROVED", "FAILED")` and immediately flips to `"PROCESSING"`. The moment either path succeeds, the settlement is no longer in a state the other path's WHERE clause matches — no separate "is this locked for automated payout" flag was needed. `VendorSettlement.payoutProvider` (`"PAYSTACK"` or `null`) exists purely for **display** (so Admin/Vendor can tell which path paid a given settlement), never as an authorization gate.

## Money Safety

- **Server-authoritative amount.** `initiatePayout(settlementId, actorUserId)` takes no amount parameter at all — the transfer amount is always `settlement.netAmount`, read from the database at send time.
- **Destination snapshot, not live destination.** `resolveRecipient` is always called with the settlement's own immutable `destinationSnapshot` (captured at `approveSettlement`, per ADR 0009) — never the Vendor's current `VendorPayoutDestination`, which may have changed since approval. The resolved `recipient_code` is cached on the settlement (`payoutProviderRecipientCode`) and reused on retry, never recreated.
- **Double-click / concurrency.** `claimSettlementForPayout` is one guarded `updateMany`; two concurrent "Send Payout" clicks race it and exactly one can win (`count === 1`). This is the same idiom `approveSettlementTransactional`/`recordPayoutTransactional` already used in M11 — no new idempotency-key table was needed.
- **Genuinely uncertain outcomes are never guessed.** A network/timeout failure calling Paystack maps to `UNKNOWN`, which leaves the settlement `PROCESSING` — never `FAILED` (which would wrongly enable a same-money retry) and never `PAID`. The only way out of an uncertain `PROCESSING` state is an independent re-verification (`checkPayoutStatus`, admin "Check status" button, or a `transfer.*` webhook) — `initiatePayout` itself refuses to run again while `status = "PROCESSING"`.
- **Retry only after a definitive failure.** `FAILED` is reachable only from a real Paystack `failed`/`reversed`/`otp` response, or a definitive (non-timeout) HTTP rejection. Retrying generates a **fresh** `payoutProviderReference` (Paystack references must be unique per transfer; a `FAILED` attempt is a known dead end, safe to abandon).
- **Webhook discipline mirrors the payment/refund side exactly.** The webhook body's `reference` is used purely as a lookup key (`findSettlementByPayoutReference`); the actual status is always re-derived via an independent `verify()` call, never trusted from the webhook payload itself. An unknown reference, or a settlement no longer `PROCESSING`, is a silent no-op — a duplicate webhook can re-run the same guarded transition and simply lose the race (`count !== 1`), never double-pay or touch an unrelated settlement.

## OTP — An Explicit Configuration Requirement, Not a New UI Step

This milestone's UX brief is explicit: one click, no multi-step provider console. Paystack's Transfers OTP feature (an SMS/email code sent to the business owner to authorize each transfer) has no place in that flow, so a `status: "otp"` response is mapped straight to `FAILED` with a diagnostic Admin can act on ("disable OTP for API transfers in Paystack settings"), never left dangling. **Isaac must disable the Transfers OTP requirement for API-initiated transfers in the Paystack dashboard** before automated payouts can complete end-to-end — documented as an operational prerequisite, not something this code can do for itself.

## Consequences

- `VendorSettlement` gains seven nullable columns (`payoutProvider`, `payoutProviderReference` [unique], `payoutProviderTransferCode`, `payoutProviderRecipientCode`, `payoutInitiatedAt`, `payoutInitiatedByUserId`, `payoutFailureReasonSafe`) and two new `SettlementStatus` values — no new tables, no new domain module, matching ADR 0008's precedent that adding real provider behavior to an existing financial model doesn't require a parallel schema.
- The manual payout path (`recordPayout`, "Record External Payout") is unchanged and remains the fallback whenever Paystack isn't the active provider or a payout must genuinely be sent outside Paystack.
- Vendor-facing status display collapses `DRAFT`/`APPROVED`/`FAILED` to a single "Awaiting payout" label — a Vendor is never shown "failed" (CrownSourceGlobal is still resolving it, via retry or manual fallback) or any Paystack-specific vocabulary (`transfer_code`, `recipient_code`, webhook events). Only Admin sees provider diagnostics.
- Automated disbursement via Hubtel/Moolre, scheduled batch payout runs, and a general reconciliation dashboard remain explicitly out of scope, per the brief's own "do not build" list.
