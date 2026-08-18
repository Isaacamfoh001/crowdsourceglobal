# ADR 0007: Pivot to Paystack as Primary Payment Provider; Moolre Deferred

## Context

M10A built CrownSourceGlobal's provider-neutral payment architecture with Moolre as the first real provider. During real sandbox testing, Moolre's integration proved workable but exposed two unresolved production risks: no documented webhook signature mechanism (ADR 0006), and an undocumented response code (`TP17`) that briefly caused a real cross-Order data-integrity bug (a non-unique placeholder value written into a unique column — since fixed, but illustrative of the friction of working against a documentation surface with real gaps).

M10A.2 pivots the **primary** real provider to Paystack, which documents a real webhook signature mechanism and a real refund API — closing exactly the two biggest open risks from ADR 0006. Moolre is not deleted: it remains selectable for development/experimental use, and its existing correctness fixes (identifier-collision handling, TP17 mapping) stay in place.

## Options Considered

**A. Keep building out Moolre as primary, treat the documentation gaps as permanent operational risk.** Rejected — an unresolved webhook-authenticity gap and no refund API are both real production liabilities `PROJECT.md`'s marketplace model (customer funds held on behalf of third-party vendors) can't comfortably accept indefinitely.

**B. Add Paystack as a second adapter, make it primary, keep Moolre alongside as an explicitly deferred/experimental option.** Chosen — the provider-neutral architecture built in M10A was designed for exactly this: adding a second real provider should mean writing a new adapter, not touching `modules/orders`, `modules/cart`, `modules/quotation`, `modules/sourcing`, `modules/fulfilment`, or `modules/resolutions`. This ADR records that the architecture held up under that test.

## Decision

**Option B.** `PAYMENT_PROVIDER=paystack` is now the intended production value; `PAYMENT_PROVIDER=moolre` remains valid for development/experimental testing only; `PAYMENT_PROVIDER=mock` remains dev/test-only and still fails closed in production (`lib/env.ts`).

## What Paystack's Documentation Actually Confirmed (not memory)

Fetched from `docs-v2.paystack.com` (the primary `paystack.com/docs/*` host returned HTTP 403 to automated fetches; the `docs-v2` mirror and targeted web searches against Paystack's own reference pages were used instead — every fact below is sourced, not inferred):

- **Ghana Mobile Money uses the Charge API**, not Transaction Initialize: `POST /charge` with `{email, amount, currency, reference, mobile_money: {phone, provider}}`. Response `data.status` drives the next step: `pay_offline` (MTN/AirtelTigo — customer must authorize on their phone, `data.display_text` is safe to show), `send_otp` (submit via `POST /charge/submit_otp` with `{otp, reference}`), `success`/`pending`/`failed`.
- **Pending-charge check**: `GET /charge/:reference`.
- **Verify Transaction (authoritative)**: `GET /transaction/verify/:reference`. `data.status` ∈ `success | failed | abandoned | reversed`. `data.amount` is in the currency's **minor unit** — pesewas for GHS, confirmed explicitly ("kobo for NGN, pesewas for GHS" per the docs' own wording) — matching the pattern this codebase already avoids floating-point math for (`lib/money.ts`'s `ghsToPesewas`/`pesewasToGhs`, string-based conversion, never a fractional multiplication).
- **Webhook signature**: `HMAC-SHA512` of the raw request body, using the secret key, compared against the `x-paystack-signature` header. This is real, confirmed, cryptographic verification — the single biggest improvement over Moolre (ADR 0006), which documents no such mechanism. Documented webhook source IPs (`52.31.139.75`, `52.49.173.169`, `52.214.14.220`) are used as a secondary, best-effort signal only, exactly as Moolre's were — the signature is the actual authority.
- **Refund API**: `POST /refund` (`{transaction, amount?, currency?, customer_note?, merchant_note?}` — `amount` optional, defaults to the full original amount, in minor units) and `GET /refund/:reference`. Refunds are **asynchronous** ("Refund has been queued for processing") — `data.status` starts `pending`, resolves later to `processed` or `failed`. Webhook events `refund.processed`/`refund.failed` exist; this integration treats them purely as a trigger to re-fetch via `GET /refund/:reference`, never trusting the webhook body's embedded status alone — the same discipline as the payment side.

## Ghana Mobile Money Provider Codes — Confirmed

Paystack's documented Ghana Mobile Money provider codes for the `mobile_money.provider` field, centralized in exactly one place (`PAYSTACK_MOMO_PROVIDER_CODES` in `modules/payments/providers/paystack/types.ts`): **MTN = `mtn`**, **AT (AirtelTigo) Money = `atl`**, **Telecel = `vod`**.

This tool's own automated fetches against Paystack's documentation were inconsistent on the AirtelTigo code specifically (one guide-page fetch returned `tgo`, aggregated third-party sources returned `atl`), and that ambiguity was flagged rather than guessed at in an earlier pass of this milestone. **Isaac verified all three codes directly against Paystack's current official Payment Channels documentation on 2026-08-18** — `atl` is confirmed correct for AirtelTigo; `mtn` and `vod` are unchanged from what was already implemented. No longer an open item.

## A Real Bug Found and Fixed While Wiring Paystack Refunds

`Refund.paymentId` existed in the schema since M9 but was **never populated** — `approveResolution()`'s refund-creation path never linked it. This meant every refund, for the entire lifetime of the schema, would have resolved to `paymentReference: null` had a real refund executor ever tried to use it — silently making real refunds impossible. Fixed at `modules/resolutions/service.ts`'s `approveResolution()`: the Order's successful `Payment.id` is now looked up and linked at approval time. No M9 refund *decision* logic changed — only this one missing link.

## Payment Identifier Semantics (generalized from ADR 0006's Moolre-specific finding)

- **`Payment.reference`** — CrownSourceGlobal's own payment-attempt identity. Sent to Paystack as `reference`/used as `transaction` for refunds; sent to Moolre as `externalref`. The only identifier Order confirmation ever keys off.
- **`Payment.providerReference`** — the provider's own TRANSACTION identity (Paystack's `data.id`; Moolre's genuine `TR099`/status `transactionid`, never a placeholder like `"all"`). Added this milestone, replacing the overloaded pre-M10A.2 use of `providerEventId` for this purpose.
- **`Payment.providerEventId`** — reserved for a genuine provider webhook/EVENT identity, distinct from the transaction itself. Not currently populated by either adapter — Paystack's webhook event and its Verify Transaction response both refer to the same transaction id, not a separate event id, so there's nothing to put here yet. Kept for a future provider that has a real, separate event identity.
- **`Refund.providerEventId`** — the refund executor's own reference for THIS refund (Paystack's refund `id`). Never populated by `MoolreRefundExecutor` (always fails closed) or a failed mock attempt.

## Refund Executor Interface — Widened for Real Async Providers

`RefundExecutor.refund()` now takes a `RefundExecutionContext` (server-approved amount/currency, the original Payment's reference — never client input) and returns a three-way `RefundExecutionResult`: `COMPLETED | PENDING | FAILED` — not the old boolean `succeeded`. `PENDING` exists specifically because Paystack's refund is asynchronous; a refund must never be marked `COMPLETED` merely because the create-refund request was accepted (this milestone's own explicit requirement). Executor selection is **provider-derived from the original Payment** (`getRefundExecutorForPaymentProvider(refund.payment?.provider)`), not from the currently-active global default — a customer may have paid weeks ago via a provider CrownSourceGlobal has since stopped routing new payments to.

## Consequences

- Adding a future third provider (or reactivating cards) requires a new adapter under `modules/payments/providers/<name>/` plus provider-config/routing — no change to any domain module. This was exactly the claim ADR 0006 made and this pivot is the proof: Paystack was added without touching `modules/orders`, `modules/cart`, `modules/quotation`, `modules/sourcing`, `modules/fulfilment`, or `modules/resolutions`'s decision logic.
- Moolre's code, tests, and sandbox diagnostics remain fully in place and passing — nothing was deleted, only de-prioritized as a routing default.
- All three Ghana Mobile Money provider codes (`mtn`/`atl`/`vod`) are now confirmed against Paystack's own current documentation — MTN, AirtelTigo, and Telecel are all clear to sandbox-test.
