# ADR 0006: Provider-Neutral Payment Architecture, with Moolre as the First Real Provider

## Context

CrownSourceGlobal needed its first real, production-capable payment provider. Ghana Mobile Money via Moolre was chosen as Provider #1, with card payments (likely Paystack) deferred to a later milestone. The architectural risk to avoid: building payment/order logic that only works for one specific provider's quirks, forcing a rewrite when a second provider is added.

Two further architectural risks specific to Moolre's documented behavior:
1. Mobile Money confirmation is genuinely **asynchronous** — an accepted API response is not proof of payment.
2. Moolre's documentation, as fetched and reviewed (`docs.moolre.com`, both its standard and `/ai/*` mirror pages), does **not** describe a webhook signature/HMAC verification mechanism.

## Options Considered

**A. Build directly against Moolre's API inside the checkout/order flow.** Fastest to ship; couples domain code to Moolre's request/response shapes, channel codes, and status vocabulary.

**B. Provider-neutral `PaymentProvider` interface, with a Moolre adapter as the only implementation.** Domain code (`modules/orders`, `modules/payments/service.ts`) depends only on a small closed set of outcome types (`ACCEPTED`/`OTP_REQUIRED`/`REJECTED`/`UNKNOWN` for initiation; `SUCCEEDED`/`FAILED`/`PENDING`/`UNKNOWN` for verification). All Moolre-specific concepts (channel codes, response codes, header names) live only in `modules/payments/providers/moolre/`.

## Decision

**Option B.** `MockPaymentProvider` is deliberately *not* forced through the same interface — its dev/test UX (explicit synchronous "succeed"/"fail" choice) is a different shape by design, and remains served by the pre-existing `attemptMockPayment` flow, unchanged. The "provider-neutral" boundary that matters is the async real-provider interface a future Paystack adapter will also implement.

## Webhook Authenticity — the Genuinely Ambiguous Point

Moolre's webhook payload carries a `status` field but no signature, secret, or verification header of any kind, in everything that could be fetched from their documentation. The only documented authenticity signal is a fixed source IP for wallet callbacks. Moolre's own webhooks guide recommends independently re-checking state via the status endpoint "for significant transactions or unusual payloads" — i.e., Moolre's own guidance is not to trust the callback body alone.

**Resolution:** the webhook is treated purely as a **trigger**. Best-effort IP filtering is applied and logged, but every confirmation path — webhook, customer polling, and admin reconciliation — funnels through one function (`applyVerifyOutcome` in `modules/payments/service.ts`) that always makes an independent, authoritated server-to-server call to Moolre's status API before ever calling `ordersService.confirmOrderPayment`. The callback's claimed status is never sufficient on its own.

**This is flagged as an open production-risk question, not a resolved one.** Before real go-live, confirm directly with Moolre support whether an undocumented signature mechanism exists. If one does, add it as an additional check — it should never replace the independent status verification described above, only strengthen it.

## Other Honest Documentation Gaps (Not Invented)

- **Refund API:** none exists in Moolre's documented Payments API (only initiate/payment-id/virtual-account/links/status/webhook are listed). `MoolreRefundExecutor` fails closed with an explicit "manual operation required" result rather than pretending an endpoint exists — but it is deliberately left unwired from `resolutionsService.processRefund`, which continues to call `mockRefundExecutor` unconditionally. Coupling that selection to `env.PAYMENT_PROVIDER` was tried and reverted: it silently changed the meaning of staff's explicit refund-simulation action based on which real collection provider happened to be configured, breaking the M9 refund test suite the moment `PAYMENT_PROVIDER=moolre` was set for real sandbox testing.
- **Full status-code enum:** only `code="SS01"` with `data.txstatus=1` was confirmed as a definitive success signal from fetchable documentation. Any other status code maps to `PENDING`, never a guessed `FAILED` — a wrongly-assumed failure could cause a genuinely-processing payment to be abandoned, while `PENDING` only delays resolution.
- **Official sandbox test phone numbers:** not found in fetchable documentation. Must be obtained directly from the Moolre dashboard/support (see the "ISAAC — MOOLRE SETUP" section of the M10A implementation report) — never invented.
- **KYC / marketplace funds-flow approval:** Moolre's go-live checklist, as fetched, describes credential/URL/monitoring readiness but says nothing about business verification or approval for a marketplace (funds collected on behalf of third-party vendors) versus a simple single-merchant flow. Flagged as a potential **live-launch blocker** requiring direct confirmation with Moolre before processing real customer funds.

## Identifier Semantics — Payment Attempt vs. Provider Transaction (found in real sandbox testing)

Three distinct identities exist on `Payment`, and only one is CrownSourceGlobal's to generate:

- `Payment.reference` — CrownSourceGlobal's own attempt identity. Generated once per attempt, sent to Moolre as `externalref`, and the ONLY identifier Order-confirmation logic (`verify()`) ever keys off. Stable across OTP resubmission and retries.
- `Payment.providerEventId` — Moolre's own transaction identifier. Only trustworthy from `TR099`'s initiate `data` field (a real UUID) or the status-verification endpoint's `transactionid` field — both confirmed genuine, unique-per-transaction values.
- There is no separate "webhook/event id" concept — the webhook payload's `data.transactionid` refers to the same transaction identity as above, not a distinct event identity.

**Real bug found in sandbox testing:** `TP17` ("Phone no. Verification Successful.", returned after OTP), like `TP14`, returns a non-identifying placeholder string (`"data":"all"`) in its response — not a genuine transaction reference. The adapter originally treated any string in `data` as a legitimate `providerEventId`, causing a real unique-constraint collision across two unrelated customers' Orders in sandbox testing (both received `"all"`). Fixed at the source: `status-map.ts`'s `TP17` handling now always returns `providerReference: null`.

As defense-in-depth (not just for this one now-fixed case — Moolre's status/transaction-id semantics are only partially documented), both write sites that ever persist a `providerEventId` (`applyAcceptedInitiateOutcome` and `applyVerifyOutcome`'s SUCCEEDED claim) now catch a `P2002` unique-constraint violation explicitly rather than let it surface as an unhandled exception:
- On the **initiate** path, the identifier is diagnostic-only (never load-bearing for confirmation) — a collision drops the identifier, flags `exceptionReason`, notifies admin, and the Payment still reaches a normal usable `PENDING` state.
- On the **verify/confirm** path, a collision means Moolre's status endpoint returned a `transactionid` already attached to a different Payment — treated as a genuine integrity anomaly per this ADR's own principle (never let two Payments independently confirm two Orders off one provider transaction). That Payment is **never** confirmed; it's flagged for manual review instead, and the Order is left `PENDING_PAYMENT`.

## Consequences

- Adding Paystack later requires a new adapter under `modules/payments/providers/paystack/` plus provider routing/config — no change to `modules/orders`, `modules/cart`, `modules/quotation`, `modules/sourcing`, `modules/fulfilment`, `modules/resolutions`, or the refund decision logic.
- `PAYMENT_PROVIDER` env var selects the active provider; production fails closed if set to `mock` (checked in `lib/env.ts`, skipped only during `next build`'s static page-data collection phase).
- A new DB-only partial unique index (`payment_one_active_per_order`) enforces at most one active Payment attempt per Order — not expressible in `schema.prisma`, documented on the `Payment` model instead.
- The abandoned-payment sweep (Workflow F) — designed at the original architecture-planning stage but never triggered by the synchronous mock flow — is now real, closing a genuine gap real asynchronous payments exposed.
