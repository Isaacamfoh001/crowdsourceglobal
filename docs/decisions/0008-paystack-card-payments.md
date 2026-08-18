# ADR 0008: Card Payments (Visa/Mastercard) via Paystack-Hosted Checkout

## Context

M10A/M10A.2 built out Ghana Mobile Money acceptance on the provider-neutral `PaymentProvider` architecture, with Paystack as the primary real provider. M10B completes customer collections by adding Visa/Mastercard acceptance, with one non-negotiable constraint: CrownSourceGlobal's servers must never receive, process, or store a raw card number, CVV, PIN, or OTP (PCI scope reduction) — and the existing Mobile Money architecture (Payment table, webhook route, verification funnel, refund executor) must be reused, not duplicated.

## Options Considered

**A. Direct card API (Paystack's Charge API with `card: {number, cvv, expiry, pin}`).** Rejected outright — this would route raw card data through CrownSourceGlobal's own backend, which is exactly the PCI-DSS exposure this milestone requires avoiding. Paystack itself steers integrators away from this for anything beyond a PCI-DSS Level 1 merchant with a dedicated compliance program, which CrownSourceGlobal is not.

**B. Paystack-hosted Checkout/Popup (`POST /transaction/initialize` → redirect to `authorization_url`).** Chosen. The customer enters card details exclusively on Paystack's own page; CrownSourceGlobal only ever sees the eventual success/failure outcome via the existing Verify Transaction / webhook mechanisms. This is the same shape as most bank/gateway redirect flows already familiar from Mobile Money's `pay_offline` step.

**C. A parallel "Card" domain (separate `CardPayment` model, separate refund executor, separate webhook route).** Rejected — this milestone's own explicit instruction ("Do not introduce a new payment domain") and ADR 0007's proven claim (adding a second provider required a new adapter, not new domain modules) both argue against it. Option B lets Card payments reuse the entire existing `Payment` table, webhook route, `applyVerifyOutcome` funnel, and `PaystackRefundExecutor` unchanged.

## Decision

**Option B.** Card is a new `PaymentMethod` value (`CARD`) on the existing `Payment` model — not a new table, not a new domain module.

### Where Card initiation deliberately breaks from the shared `PaymentProvider` interface

`PaymentProvider.initiate()` (`modules/payments/provider.ts`) is Mobile-Money-shaped: `network`, `phone`, `otpcode` have no card equivalent, and Transaction Initialize's request/response shape (`{email, amount, currency, reference, callback_url, channels}` → `{authorization_url, access_code, reference}`) doesn't fit `InitiatePaymentOutcome`'s `ACCEPTED | OTP_REQUIRED | REJECTED | UNKNOWN` union either — there is no OTP step at CrownSourceGlobal's layer for cards (3-D Secure, if triggered, happens entirely on Paystack's hosted page). Rather than force an artificial fit onto the shared interface (widening it with card-only optional fields every Mobile Money caller would have to ignore), card initiation is a separate, Paystack-specific function — `initiatePaystackCardPayment` (`modules/payments/providers/paystack/adapter.ts`) — called directly by `paymentsService.initiateCardPayment()`, never through `getActivePaymentProvider()`. This mirrors the existing precedent of `MockPaymentProvider` also not implementing the shared interface (ADR/provider.ts's own documented reasoning): a fundamentally different initiation shape gets its own function, while everything *after* initiation stays on the one shared path.

### What stays fully shared, unchanged, with Mobile Money

- **The `Payment` table** — `method=CARD`, `network=null`, same `payment_one_active_per_order` partial unique index (a customer cannot have an active Mobile Money attempt and an active Card attempt on the same Order simultaneously).
- **The webhook route** (`POST /api/payments/paystack/webhook`) — Paystack sends `charge.success`/`charge.failed` for card transactions using the exact same event shape as Mobile Money; `parseWebhook` never inspects channel/method.
- **`applyVerifyOutcome`** — the single funnel every outcome (poll, webhook, admin reconciliation, card-return landing) passes through. Amount/currency mismatch quarantine, the guarded `SUCCEEDED` `updateMany`, and the late-success-after-cancellation exception path all apply identically.
- **`PaystackRefundExecutor`** — refunds key off `Payment.reference` (Paystack's `transaction` field for the Refund API), never `Payment.method`. No `CardRefundExecutor` exists or is needed; proven directly by a test asserting an identical PENDING→COMPLETED refund lifecycle for a `method=CARD` Payment (`modules/resolutions/paystack-refund.test.ts`).
- **Customer-facing polling** (`getPaymentStatusForCustomer`) — used by both the Mobile Money pending screen and the new card-return landing page's poller.

### The one new customer-facing surface: the return landing page

Unlike Mobile Money (which polls in place after `pay_offline`), Card payment leaves the CrownSourceGlobal site entirely for Paystack's hosted page, then returns via `callback_url`. `app/(public)/checkout/[orderId]/payment/callback/page.tsx` is the landing point. Per this milestone's explicit rule ("browser callback is never proof of success"), this page never trusts its own arrival or any query-string parameter as proof of anything — `reference` is used purely as a lookup key (scoped to the authenticated customer's own Order), and the actual result always comes from an independent `provider.verify()` call through the same `applyVerifyOutcome` funnel webhooks and polling use (`paymentsService.getCardReturnStatusForCustomer`). `callback_url` itself is always server-generated from `env.NEXT_PUBLIC_APP_URL`, never a client-supplied or `Host`-header-derived value.

### Safe card display

Paystack's Verify Transaction response includes an `authorization` object with `card_type` (brand) and `last4` for card transactions. Two new nullable columns — `Payment.cardBrand`, `Payment.cardLast4` — are populated only on `SUCCEEDED` verification, from this object, never from anything CrownSourceGlobal collects itself. Admin Payments (list + detail) and the customer Order detail page both render `{brand} •••• {last4}` when present; every other Payment field (PAN, CVV, PIN, OTP) is structurally impossible to reach CrownSourceGlobal in the first place — there is no field for it anywhere in the request or response shapes this integration ever touches.

### Why no separate "Card" admin page

Admin Payments already lists/filters by provider and status; this milestone extends the existing list/detail views to branch on `method` (Mobile Money → network; Card → brand/last4; Mock → "Mock") rather than adding a parallel page, consistent with "handle all 4 provider/method/network combinations without a separate Card page." (While auditing this, the admin reconciliation button's visibility condition — previously gated on `provider === "MOOLRE"` only — was widened to any non-mock provider, since `reconcilePaymentAsAdmin` already supported Paystack; this was a pre-existing gap unrelated to cards specifically, fixed as part of the same "all 4 combinations" pass.)

### A pre-existing display bug found and fixed while wiring this

The customer Order detail page's payment summary branched on `payment.provider === "MOOLRE"` to decide whether to show "Mobile Money (network)" vs. "Development payment" — a holdover from before Paystack became primary (ADR 0007). Since that pivot, every real Paystack Mobile Money payment has been incorrectly labeled "Development payment" on the customer's own order page. Fixed to branch on `method` instead of `provider` (`MOBILE_MONEY` → "Mobile Money (network)", `CARD` → "Card (brand •••• last4)", `MOCK` → "Development payment") — the correct semantic distinction regardless of which real provider is active.

## Consequences

- International cards (non-Ghana-issued) are a live Paystack merchant-account capability, not a CrownSourceGlobal code branch — the same `initiateCardPayment` path handles them once the live account is configured for it.
- Adding a future payment method that fits the Mobile-Money-shaped `PaymentProvider` interface goes through the shared interface; a method that doesn't (like Card) gets its own adapter-specific initiation function while still landing on the same `Payment` table, webhook, verify, and refund paths — this ADR is the second proof point (after ADR 0007) that domain-layer reuse holds even when the initiation shape itself can't be unified.
- `Payment.cardBrand`/`cardLast4` are the only new persisted fields this milestone required — no new tables, no new domain module, no new webhook route.
