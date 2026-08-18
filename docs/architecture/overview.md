# CrownSourceGlobal — Architecture Overview

Authoritative summary of the approved V1 architecture. See `/docs/domain/entities.md` for the data model, `/docs/domain/state-machines.md` for entity lifecycles, `/docs/workflows/workflows.md` for end-to-end flows, and `/docs/decisions/` for the rationale behind decisions that are expensive to reverse.

## Domain / Module Map

| Domain | Responsibility |
|---|---|
| Identity & Access | Authentication (Better Auth) and session/role only |
| Customers | Buyer profile (individual or business-tagged) |
| Vendors & Vendor Verification | Supplier company profile and trust state |
| Catalogue | Category taxonomy + `VendorListing` (the sellable unit — see ADR 0003) |
| Pricing | Bulk tier rules, vendor supply cost, margin policy, promotions |
| Cart | Mutable, pre-commercial buyer intent |
| Quotation | Immutable priced commercial offer (instant or custom origin) — `modules/quotation` (INSTANT origin implemented M5; CUSTOM_SOURCING origin implemented M6) |
| Custom Sourcing | Managed-procurement process (staff-curated supply options, allocation, commercial offer) that produces a CUSTOM_SOURCING Quotation — `modules/sourcing` (implemented M6) |
| Checkout & Orders | Converts a Cart or accepted Quotation into a durable Order |
| Fulfilment | Vendor-scoped responsibility for a subset of an Order, plus its Shipment (physical movement) and FulfilmentIssue (operational exception) — `modules/fulfilment` (implemented M4) |
| Logistics | ReceivingLocation reference data for CrownSource-designated international inbound destinations — `modules/logistics` (implemented M4) |
| Payments | Collects money from the customer, provider-agnostic |
| Post-Purchase Resolution | "What happens when an order can't complete normally" — cancellations, returns, replacements, refund decisions, at line/quantity granularity — `modules/resolutions` + `modules/refunds` (implemented M9) |
| Vendor Payouts | Pays vendors, computed from historical Fulfilment economics |
| Documents | Thin layer generating artifacts from immutable snapshots |
| Messaging | Contextual two-way conversation, two shapes only (Customer↔CSG, CSG↔Vendor) |
| Notifications | Domain event → in-app record → (optionally) queued email, decoupled from every other domain — `modules/notifications` (implemented M7) |
| Administration | Permission/operational surface over other domains — not a parallel business-logic layer |
| Admin Operations Dashboard | Read-only aggregation over every other domain's existing tables — "what needs CrownSource attention right now" — `modules/admin-dashboard` + `modules/operations` (implemented M8) |
| Audit | Append-only record of who-did-what across all domains |

**Structural note:** there is no canonical cross-vendor `Product` entity. `VendorListing` is the sellable unit — see ADR 0003.

### Strong domain separations

- **Order vs. Fulfilment** — different owners (CSG vs. vendor-scoped), different visibility.
- **Payments vs. Vendor Payouts** — different legal/financial character, different timing, different counterparty.
- **Pricing vs. Catalogue** — different trust boundary (vendor cost/margin must not leak to the wrong party).
- **Quotation vs. Custom Sourcing** — the exploratory process vs. the resulting binding offer.
- **Fulfilment vs. Shipment** — "whose responsibility" vs. "how it physically moved."
- **Cart pricing vs. authoritative pricing** — Cart is informational; only checkout revalidation or an accepted Quotation produce a chargeable number.
- **Messaging: Customer-thread vs. Vendor-thread** — never merged, structurally preventing a direct Customer↔Vendor channel.
- **Identity vs. business-profile data** — auth mechanics stay independent of "who is this business."
- **Domain event vs. communication channel** *(M7)* — no domain service (vendor applications, listings, orders, fulfilment, quotation, sourcing, messaging) knows about Resend, email templates, or the job queue. Every one of them calls a single `notificationsService.notify()`; the notification module alone decides whether/how an email is queued. See "Notifications & Email Delivery" below.
- **Operational visibility vs. domain mutation** *(M8)* — `modules/admin-dashboard` only ever reads other modules' data (via their existing repositories/services wherever one already exists, or a small number of new bounded read queries where none did) and never writes to them. Every "quick action" a dashboard surface offers is a link to the existing module's own page, which calls that module's own existing service — the dashboard never grows its own parallel mutation path.
- **Refund decision vs. refund execution** *(M9)* — `modules/resolutions` decides whether a refund is approved, its amount, and why; `modules/refunds/mockExecutor.ts` is the sole thing that "executes" it (a mock stand-in for a future production provider call). Nothing in `modules/resolutions` moves money — see "Post-Purchase Resolution" below.
- **Customer request vs. staff decision** *(M9)* — a Customer's `requestedResolution` is a stated preference only; only `ResolutionCaseItem.approvedResolution` (always staff-set) has any financial or operational effect. The same authority split applies to Vendors: they can only respond to an operational request, never approve/close/execute anything.

## Application Architecture Shape

**Decision: single full-stack Next.js application, modular monolith.** See ADR 0001 for the full comparison against a split frontend/backend and a services-based decomposition.

Domain modules under `/modules` are framework-agnostic (no Next.js imports) so route handlers stay thin wrappers. This preserves a future path to a dedicated API/mobile client (exposing the module layer behind a stable HTTP contract) without paying the operational cost of that split today.

Background/async work (webhook post-processing, email, PDF generation, inventory-reservation sweep, payout batching) runs via a **database-backed job table with a polling worker process** — no message broker.

## Technology Stack

| Area | Choice | Notes |
|---|---|---|
| Language | TypeScript | Frontend and backend |
| Framework | Next.js (App Router) | SSR for public/commerce pages, server actions for mutations |
| Database | PostgreSQL | Relational integrity for the snapshot/idempotency invariants |
| ORM | Prisma | Type-safe, shared types with the rest of the TS stack |
| Authentication | Better Auth | Email/password + Google OAuth + secure linking — see ADR 0002 |
| Authorization | Custom `can(user, action, resource)` per module | No RBAC library at this stage |
| Validation | Zod | Shared schemas client/server |
| API strategy | Server actions/route handlers for the app; narrow `/api/v1` for payment webhooks and future external consumers | |
| File/object storage | Provider TBD (R2 or S3 planned) — `lib/storage.ts`'s `StorageProvider` interface, local-disk dev adapter only so far (M6, sourcing-request attachments) | No production credentials invented; swapping providers means implementing the same three-method interface, no domain-layer changes |
| Image handling | `sharp` on upload, Next.js `<Image>` on render | |
| Payments | Provider-neutral `PaymentProvider` interface (`modules/payments/provider.ts`); Moolre (Ghana Mobile Money — MTN/Telecel/AirtelTigo) implemented first, M10A. Cards/Paystack deferred — see ADR 0006 | `MockPaymentProvider` remains for dev/tests, not forced through the same interface (different, synchronous shape by design); production fails closed if `PAYMENT_PROVIDER=mock` |
| Email | `EmailProvider` interface (`lib/email-provider.ts`); `ConsoleEmailProvider` (zero-config dev default) or `ResendEmailProvider` (plain `fetch` against Resend's API, no SDK dependency) selected via `EMAIL_PROVIDER` | Resend chosen M7 — transactional focus, simple HTTP API, no infra to run. Fails fast at startup if `EMAIL_PROVIDER=resend` without `RESEND_API_KEY`/`EMAIL_FROM` |
| In-app notifications | `Notification` table (`modules/notifications`), persisted synchronously in the same call as the domain event, independent of email | Implemented M7. No real-time channel in V1 — see "Future Realtime Path" below |
| Background jobs | `EmailDeliveryJob` table + polling drain (`lib/email-worker.ts`, `scripts/process-email-jobs.ts`, M7); abandoned-payment sweep (`scripts/sweep-abandoned-payments.ts`, M10A) | Two narrow, purpose-built jobs rather than a generic `BackgroundJob` table — each is a direct query against its own source-of-truth rows (expired `EmailDeliveryJob`, expired `InventoryReservation` with no successful `Payment`), not a generic queue |
| PDF/documents | `@react-pdf/renderer` | No headless browser infra |
| Search | PostgreSQL full-text (`tsvector`) + trigram | No dedicated search infra until evidence demands it |
| Caching | None by default | Add only against a measured hot path |
| Logging | `pino` structured JSON, request-correlation IDs | |
| Error monitoring | Sentry | |
| Testing | Vitest (unit/domain), Playwright (E2E) | E2E covers the workflows in `/docs/workflows/workflows.md` |
| CI/CD | GitHub Actions | Lint/typecheck/test on PR, deploy on merge to `main` |
| Hosting | Vercel (app) + managed Postgres (Neon/Supabase) + small container/worker host (Fly.io/Render) for the background job process | Confirm once team ops preference is known |

## Repository Structure

```
/app                        Next.js App Router
  /(public)                 marketing, marketplace browse, listing pages,
                             vendor storefronts, "become a vendor", custom-sourcing landing
  /(customer)                authenticated customer app: account, orders, quotes,
                             custom requests, messages, invoices
  /(vendor)                  vendor portal: dashboard, listings, fulfilments, payouts,
                             notifications, company profile
  /(admin)                   admin portal: moderation, orders, payments, payouts,
                             custom sourcing, vendor verification, platform settings
  /api                       route handlers needing a stable HTTP contract
    /payments/moolre/webhook  Moolre payment provider webhook (M10A; actual path — differs from the originally-planned /webhooks/payments)
/modules                    framework-agnostic domain logic (no Next.js imports here)
  /identity
  /customers
  /vendors
  /catalogue                 Category, VendorListing
  /pricing
  /cart
  /quotation
  /sourcing                  Custom Sourcing (implemented M6; named `sourcing`, not `custom-sourcing`)
  /orders
  /fulfilment
    /shipment                 submodule
  /payments                    provider-neutral service + mockProvider.ts; /providers/moolre
                                 (M10A — client/adapter/types/status-map)
  /payouts
  /resolutions                M9 — ResolutionCase/Return/Replacement domain: types, policy
                               (cancellation eligibility, refund-amount/quantity caps), repository,
                               service (the case state machine + every side-effect it triggers)
  /refunds                    M9 — mockExecutor.ts only (the refund EXECUTION boundary — the
                               DECISION lives entirely in modules/resolutions)
  /documents
  /messaging
  /notifications              types, policy (required-vs-optional email), links (deep-link builders),
                               repository, service — implemented M7
  /administration             permission/policy surface, no duplicated business logic
  /operations                 M8 — centralized ageing thresholds + classification (policy.ts only,
                               no repository/service — this module has no persisted state of its own)
  /admin-dashboard            M8 — read-only aggregation: types, repository (KPI counts + bounded
                               search queries), service (attention-item derivation, role filtering)
  /audit
  # each module: service.ts, repository.ts, policy.ts (authorization), types.ts, *.test.ts
/prisma                      schema.prisma, migrations
/lib                          shared infra: db client, session/auth helpers, storage client,
                              email-provider.ts (adapter), email-templates.ts + -registry.ts
                              (branded HTML/text rendering), email-worker.ts (durable drain),
                              email.ts (auth-only verification/reset emails)
/scripts                      process-email-jobs.ts — standalone email-queue drain entrypoint
/components                   shared UI primitives (role-agnostic)
/tests
  /e2e                         Playwright, covering the workflows in /docs/workflows
/docs
  /architecture
  /domain
  /workflows
  /decisions
```

## Admin Permission Model

Three roles for V1: `SUPER_ADMIN` (full access), `OPS_ADMIN` (vendors, listings, orders, fulfilment, custom sourcing, messaging), `FINANCE_ADMIN` (payments, refunds, payouts). Splitting finance out is the one granularity worth having given real money movement.

**Capability matrix (documented M8, enforced since M3/M4 — not new)**:

| Area | SUPER_ADMIN | OPS_ADMIN | FINANCE_ADMIN |
|---|---|---|---|
| Vendor applications | ✓ | ✓ | ✓ *(unrestricted since M3 — unchanged)* |
| Listing moderation | ✓ | ✓ | ✓ *(unrestricted since M3 — unchanged)* |
| Custom sourcing | ✓ | ✓ | ✓ *(unrestricted since M6 — unchanged)* |
| Quotations (view) | ✓ | ✓ | ✓ *(unrestricted since M5/M6 — unchanged)* |
| Operations / fulfilment / logistics | ✓ | ✓ | ✗ *(`allowedRoles` since M4)* |
| Messaging | ✓ | ✓ | ✗ *(`allowedRoles` since M3)* |
| Resolutions / refunds / returns / replacements | ✓ | ✓ | ✗ *(`allowedRoles` since M9 — refund/financial-decision visibility for FINANCE_ADMIN is an explicit future capability-matrix decision, not assumed now)* |
| Admin dashboard | ✓ full | ✓ full | ✓ non-operational sections/counts only |
| Admin search | ✓ all categories | ✓ all categories | ✓ excludes vendor/shipment/order/operational/resolution-case results |

This is not a new RBAC framework — it is simply `requireAdminSession`'s existing per-route `allowedRoles` parameter, already in use since M3/M4, now also mirrored by `modules/operations/policy.ts`'s `canAccessOperationalModules()` for the M8 dashboard/search surfaces so they never link a role at a route it can't open.

## Notifications & Email Delivery *(implemented M7)*

**Event vs. channel.** Every domain module that used to call an email function directly (`modules/vendor-applications`, `vendor-listings`, `payments`, `fulfilment`, `quotation`, `sourcing`, `messaging`) now calls one thing: `await notificationsService.notify({recipientUserId, type, title, body, targetUrl, eventKey, email?})`. Domain services know nothing about Resend, HTML templates, or the job table — `notify()` is a fast local DB write, not a slow external call, so it is `await`ed everywhere rather than fire-and-forget.

**Recipient model.** `Notification.recipientUserId` points directly at Better Auth's `User.id` — there is no separate role-scoped recipient table. This is what makes a User who is simultaneously a Customer, a Vendor owner, and a SUPER_ADMIN see one deduplicated notification stream regardless of which portal's bell renders it, without any special-case merging logic.

**Dedup/idempotency.** `Notification` has a unique constraint on `(recipientUserId, eventKey)`. `notificationsRepository.create()` catches the resulting Prisma P2002 violation and returns `null` — a safe no-op. This is what makes retried callbacks (payment retries, admin double-clicks, worker retries) produce at most one notification per recipient per logical event, without a separate idempotency-key table.

**Required vs. optional email.** `modules/notifications/policy.ts` holds a single `Record<NotificationType, {required:true} | {required:false, category}>` map — the one place that decides whether an email can be preference-gated. In-app notifications are **never** gated by preference; only the email channel is, and only for the three togglable categories (orders/delivery, quotations/sourcing, messages). Moderation outcomes, commerce-critical confirmations, and admin-facing events are `required: true` and always send regardless of preference.

**Durable delivery.** `EmailDeliveryJob` (not a generic `BackgroundJob`) is created in the same DB transaction as the `Notification` row when an event warrants email. A dedicated table was chosen over a generic job table because email is the only async job type in the system today — see CLAUDE.md §6/§18's overengineering guidance; a generic table is the natural next step if a second job type appears, not before. `claimNextJob()` fetches a small candidate batch and atomically claims one row via a guarded `updateMany` (`status: eligible.status` in the WHERE clause), walking the batch rather than giving up after one lost race, so concurrent drain calls don't starve each other. Backoff on failure is bounded — `[1m, 5m, 30m, 2h, 12h]` — and a job that exhausts `maxAttempts` (default 5) is left `FAILED` permanently ineligible (the claim query's `attempts < maxAttempts` filter excludes it; no separate terminal enum value needed).

**Provider abstraction.** `lib/email-provider.ts` exports one `EmailProvider` interface with two implementations: `ConsoleEmailProvider` (zero-config, logs to stdout, the dev/test default) and `ResendEmailProvider` (plain `fetch` against Resend's HTTP API — no SDK dependency for one POST endpoint). Selected via `EMAIL_PROVIDER` (`console` default, `resend` in production); `resend` without `RESEND_API_KEY`/`EMAIL_FROM` fails at startup with a clear error rather than silently falling back.

**Templates.** `lib/email-templates.ts` renders one shared branded HTML shell (inline styles — email clients don't load external CSS) plus a plain-text fallback from a small structured `TemplateContent` shape. `lib/email-templates-registry.ts` maps each of the 24 `NotificationType` values to a `(data) => TemplateContent` function. No ad-hoc string concatenation.

**Auth email exception.** `sendVerificationEmail`/`sendPasswordResetEmail` (`lib/email.ts`) remain direct, synchronous calls from Better Auth's hooks — not routed through `notificationsService.notify()`. Deliberate: the user is actively waiting in the same flow, no in-app notification center is reachable at that point (the account is often not yet accessible), and Better Auth's hooks are already the minimal natural call site. This is the one documented, deliberate exception to "every notification event goes through one mechanism."

**In-app persistence is independent of email.** `notify()` always creates the `Notification` row first; the `EmailDeliveryJob` (if any) is created in the same transaction but its *sending* is a separate, later, fully decoupled step. A Resend outage cannot roll back or block a vendor-application approval, an order confirmation, or any other domain transition — the failure is caught, logged, and left for the job's own retry/backoff cycle.

**Future realtime path.** Nothing in this design blocks adding a WebSocket/SSE layer later: a future publisher would simply also emit `NotificationCreated`/`MessageCreated` from inside `notify()`/`messagingService`, alongside the DB write it already does. No realtime transport exists in V1, and none is required to add it later without redesigning the persistence boundary.

## Admin Operations Dashboard *(implemented M8)*

**Purpose.** `/admin` answers one question: *what needs CrownSource attention right now?* It is a read-only aggregation layer sitting above the existing per-domain admin surfaces (vendor applications, listings, sourcing, quotations, operations, messages) — it does not rebuild, replace, or duplicate any of them. Every attention item and search result deep-links back to the real, existing detail page for that record.

**Derived, not persisted.** There is no `AttentionItem` database table. Every attention item (`modules/admin-dashboard/types.ts`'s `AttentionItem`) is computed at read time from source-of-truth domain records already in the database — a vendor application's `submittedAt`, a fulfilment's `status`/`updatedAt`, a conversation's last message's `senderIsStaff`, and so on. This is what makes items disappear automatically the moment the underlying condition resolves (a vendor application gets approved, a conversation gets a staff reply, a fulfilment issue gets resolved) — there is no separate "mark resolved" action to forget, and no second system that could drift out of sync with the real one.

**Severity is a shared, centralized curve.** `modules/operations/policy.ts` holds every ageing threshold (`OPS_VENDOR_APPLICATION_WARNING_HOURS`, `OPS_LISTING_REVIEW_WARNING_HOURS`, `OPS_MESSAGE_RESPONSE_WARNING_HOURS`, `OPS_SOURCING_STALE_HOURS`, `OPS_FULFILMENT_PREPARING_WARNING_HOURS`, `OPS_SOURCING_DEADLINE_WARNING_DAYS`) plus the classification functions that turn an age into a severity. These are documented operational defaults, not contractual SLAs (same pattern as M5's `QUOTE_VALIDITY_DAYS`) — PROJECT.md does not mandate exact figures, so they're configurable via environment variables rather than buried as magic numbers. The escalation curve is uniform across every ageing-based category: below the threshold is `NORMAL` (routine, not shown as an attention row — only reflected in a plain count elsewhere on the dashboard); the threshold up to 2× is `NEEDS_ATTENTION`; 2× or beyond is `CRITICAL`. A structural failure (an unresolved fulfilment exception, a failed delivery) is always `CRITICAL` regardless of age — it isn't "getting worse over time," it's already broken.

**Lead-time-aware fulfilment ageing, with a documented limitation.** Per-fulfilment ageing for "stuck in preparation" prefers the vendor's own promised lead time (`Vendor.leadTimeDaysDefault`) over the global default when set. No `OrderItem`/`FulfilmentItem` lead-time *snapshot* exists in the schema (unlike pricing, which is always snapshotted at order-confirmation time) — this is a known gap, not an oversight: adding one speculatively, only to feed a staff-triage heuristic, would be exactly the kind of premature schema expansion CLAUDE.md's overengineering guidance warns against. The current vendor lead time is used as a best-effort *operational* signal only, never as commercial/authoritative data — if the vendor's lead time changes after an order is placed, in-flight ageing calculations use the new value. A future lead-time snapshot column is the natural fix if this class of drift ever becomes a real problem.

**Role/access mirrors existing route gating exactly — never invents new restrictions.** `modules/operations/policy.ts`'s `canAccessOperationalModules(role)` returns `true` for `SUPER_ADMIN`/`OPS_ADMIN` and `false` for `FINANCE_ADMIN`, mirroring the `allowedRoles` arrays already enforced on the Messages/Operations/Logistics routes since M3/M4 (`requireAdminSession(path, ["SUPER_ADMIN", "OPS_ADMIN"])`). The dashboard service uses this single function to decide which attention categories, summary counts, and search result types to include for a given role — so a card or search result never points a role at a route that would 404 them. Vendor-applications/listings/sourcing/quotations remain open to all three admin roles on the dashboard, exactly as their underlying routes already are today — M8 deliberately neither widens nor narrows any existing access boundary.

**Search.** One bounded, parallel-query service — `Promise.all` across Order/Quotation/CustomSourcingRequest/Vendor/CustomerProfile/VendorListing/Shipment, each an exact or `ILIKE`, `take: 6` query. No dedicated search infrastructure (no Elasticsearch/Algolia/Meilisearch) — PostgreSQL is sufficient at this scale, per CLAUDE.md §16. Two entities have no dedicated admin detail page today (Order, Customer) — search results for them link to the closest real existing surface instead of inventing a new one: an Order result links to its first Fulfilment's `/admin/operations/[id]` page; a Customer result links to their most recent Quotation or Order. A dedicated `/admin/orders/[id]` or customer-360 page is a natural, explicitly deferred future addition, not built now (CLAUDE.md §25's "do not build a full customer-360/CRM profile in M8").

**Privacy.** The aggregation layer never selects `VendorCostRule`/`vendorPayableBasis`/vendor pickup contact fields, and the message-attention query (`messagingRepository.findOpenConversationsForAttention`) deliberately never selects `Message.body` at all — "awaiting staff reply" is derived purely from who sent the last message and when, so raw message content can never leak into a cross-module summary. See the M8 privacy sweep in the milestone report for the full review.

**Safe KPIs only.** "Today" (orders confirmed, orders delivered, sourcing requests submitted, vendor applications received, quotes issued — each backed by a real, existing timestamp field, not an invented one) and "Current" (active vendors/listings, fulfilments in progress). No GMV, revenue, margin, conversion rate, or AOV — real payment/financial infrastructure doesn't exist yet, so none of those figures would be authoritative. The "Today" block supports a date-range switch (today/7d/30d); the attention queue deliberately does not — it always reflects current unresolved work, never hidden behind a date filter.

## Post-Purchase Resolution *(implemented M9)*

**Purpose.** M9 answers "what happens when an order can't complete normally" — cancellations, damaged/wrong/missing items, returns, replacements, and refund decisions — before any real money movement exists (M10) or vendor payouts run (M11). The central rule the whole domain is built around: **one failed item never forces a whole multi-vendor Order into a binary refunded/not-refunded state.** There is no `order.refunded` flag anywhere in the schema.

**Line/quantity-level, not order-level.** `ResolutionCase` is order-scoped (it references one `Order` and one `CustomerProfile`) but its actual content lives on `ResolutionCaseItem` — one row per affected `OrderItem`, carrying its own `quantityAffected`, `approvedResolution`, and `approvedRefundAmount`. A single Order can have zero, one, or many cases over its lifetime, each touching only the specific lines/quantities it's actually about; every other line and Fulfilment on that Order is completely unaffected.

**Customer request vs. staff decision.** A Customer can only state a `requestedResolution` (cancellation/refund/replacement/redelivery/other) when opening a case — this has no effect on its own. Only `ResolutionCaseItem.approvedResolution`, always set by staff via `resolutionsService.approveResolution()`, has any financial or operational consequence. A Vendor can only respond to an operational request (`AWAITING_VENDOR`); they cannot approve a refund, close a case, or clear a payout hold — enforced structurally (no vendor-facing action exists for any of these), not just by convention.

**Case state machine.** `OPEN → UNDER_REVIEW → (AWAITING_CUSTOMER | AWAITING_VENDOR, either can return to UNDER_REVIEW) → RESOLUTION_APPROVED → RESOLVED → CLOSED`, with `REJECTED` reachable from `OPEN`/`UNDER_REVIEW`/either awaiting-state. Every transition is a guarded `updateMany` with an explicit `fromStatuses` WHERE clause — the same discipline used throughout every other state machine in this codebase (Fulfilment, CustomSourcingRequest, Quotation). `RESOLUTION_IN_PROGRESS` is modeled in the enum for future use but not currently a required stop, mirroring how `Fulfilment.ACCEPTED` is modeled-but-unused in M4 — a real future need can start using it without a schema change.

**Cancellation eligibility is a hint, not a hard gate.** `modules/resolutions/policy.ts`'s `classifyCancellationEligibility(fulfilmentStatus)` returns `SAFE` (still `PENDING` — vendor hasn't started), `NEEDS_REVIEW` (`PREPARING`/`READY`/`DISPATCHED`), or `BLOCKED` (`DELIVERED`+ — cancellation no longer applies, the report-a-problem/return flow takes over). Only `BLOCKED` actually prevents case creation server-side; `SAFE` vs. `NEEDS_REVIEW` only changes what staff sees, not who decides — every cancellation, even the "safe" ones, still goes through the same manual admin approval as every other case, since a Customer can never single-handedly trigger an actual refund (see "Customer request vs. staff decision" above).

**Refund amount is always server-computed and capped, never client-supplied.** `modules/resolutions/policy.ts`'s `validateRefundAmount()` checks a proposed amount against `OrderItem.unitPrice × OrderItem.quantity` (the line's historical, immutable paid value — never current `VendorListing` pricing) minus whatever has already been approved for that same `OrderItem` across *every* case that has ever touched it (`resolutionsRepository.sumApprovedRefundForOrderItem()`). This is what makes "Case A refunds GH₵700, Case B tries to refund another GH₵700 on a GH₵1,000 item" fail at approval time, deterministically, regardless of which case runs first. `validateQuantity()` enforces the same cumulative cap for replacement/return quantities.

**Refund decision vs. execution.** `Refund` is the decision record — `PENDING_APPROVAL → APPROVED → PROCESSING → COMPLETED | FAILED`, created already `APPROVED` by `approveResolution()` (staff already decided the amount in the same action). `modules/refunds/mockExecutor.ts` is the *execution* boundary, shaped identically to M2/M3's `mockPaymentProvider.charge()` — a future `ProductionPaymentProvider.refund()` slots into the exact same call site. `resolutionsRepository.claimRefundForProcessing()` is a guarded `updateMany` (`status: {in: ["APPROVED","FAILED"]}` → `PROCESSING`) that makes retrying a refund idempotent: a `COMPLETED` refund can never be re-claimed, so a duplicate "process refund" click cannot produce a duplicate payout.

**Financial corrections are additive, never rewrites.** No `OrderItem`/`FulfilmentItem` snapshot is ever mutated by a resolution. A refund is a new `Refund` row; historical pricing stays exactly as it was captured at order-confirmation time (see `/docs/workflows/workflows.md`'s Commercial Snapshot Timing). This is the same principle ADR 0005 already established for payout corrections, applied here to the customer-refund side.

**Payout hold, not payout adjustment.** When `approveResolution()`'s `responsibility` is `VENDOR` and the decision is refund-bearing or a replacement, the affected `FulfilmentItem.payoutHold`/`payoutHoldReason` are set — the exact mechanism ADR 0005 built in M4 and left unused until now. `PayoutAdjustment` is deliberately *not* used here: nothing has ever been paid out yet (no `PayoutRun` exists until M11), so there is nothing to net a correction against — only something to prevent from being paid out prematurely.

**Inventory restock is never automatic.** Cancelling a `PENDING`/`PREPARING`/`READY` Fulfilment (via `approveResolution()`'s `cancelFulfilmentId`) releases that Order's `InventoryReservation` and increments `VendorListing.availableQuantity` back — but a damaged-item refund with no cancellation touches inventory not at all (the goods are gone, not returned). For a `RETURN_AND_REFUND`/`RETURN_AND_REPLACEMENT` decision, restocking only happens after an explicit `RESELLABLE` inspection outcome (`resolutionsService.inspectReturn()`), guarded by `Return.restockedAt` so a return can never be restocked twice.

**Replacement reuses M4 tracking — no parallel delivery system.** `Replacement` is a thin link record (`resolutionCaseId`, `originalOrderItemId`, `quantity`, `replacementOrderItemId`). `resolutionsService.createReplacementFulfilment()` creates a brand-new, zero-value `OrderItem` (`unitPrice`/`lineTotal`/`vendorPayableBasis` all `0` — no fake customer charge) plus a `Fulfilment`/`FulfilmentItem`/`Shipment`, using the exact same construction shape `confirmOrderPayment()` already uses for a normal order (`modules/orders/service.ts`). The replacement then progresses through the ordinary `PENDING → PREPARING → READY → DISPATCHED → DELIVERED` lifecycle, visible in the same vendor-portal Operations pages and the same customer order-tracking UI — no new tracking UI was built.

**Messaging stays two structurally separate channels.** `Conversation.contextResolutionCaseId` is valid for both `CUSTOMER` and `VENDOR` participant types — the same field, but it produces two genuinely different `Conversation` rows for the same case (customer↔CrownSource and vendor↔CrownSource), never one shared thread. A Vendor's case view (`resolutionsService.getForVendor()`) structurally cannot include the customer's description, contact info, or conversation — those fields simply don't exist on `VendorCaseDetail`'s type.

**Internal notes live in the activity log, not a second table.** `ResolutionCaseActivity` (mirroring M6's `SourcingRequestActivity` exactly) doubles as both the case timeline and the home for staff-only internal notes (`type: "internal_note"`) — this log was already never customer/vendor-visible, so it needed no new model to also hold notes.

## Security Summary

Full detail in `/docs/workflows/workflows.md` and the decision records; the headline mechanisms:

- Customer/vendor isolation enforced at the repository layer via session-derived scoping, never UI hiding.
- Client never supplies price; authoritative pricing is always server-derived (checkout revalidation) or copied from a server-issued Quotation.
- Inventory reservation is atomic with `PENDING_PAYMENT` Order creation, preventing oversell under concurrent checkouts.
- Payment webhooks are idempotent on the provider's event id/CrownSourceGlobal's own reference. Moolre (M10A) documents no webhook signature mechanism — its callback is treated as a trigger only; every confirmation path independently re-verifies status via Moolre's own status API before ever confirming an Order (ADR 0006 — flagged as an open production-risk question, not silently assumed safe).
- Fulfilment creation and payout claiming are idempotent via database uniqueness constraints, not application-level locking alone.
- Every domain service emits an `AuditEvent` inline with its own state-changing transaction.
- Notification read/list/mark-read queries are always scoped by session-derived `recipientUserId`; `targetUrl` deep links are built server-side from known route shapes (`modules/notifications/links.ts`), never from a client value or a request Host header — no open-redirect surface.
- The M8 admin dashboard/attention queue/search are all gated by `requireAdminSession`; the calling admin's `role` (server-derived from the session, never client-supplied) determines which attention categories, counts, and search result types are included — a query string can filter *within* what a role is already permitted to see, never expand it.
- M9 resolution cases are always scoped server-side: `getForCustomer`/`getForVendor` query by `(caseId, customerProfileId)`/`(caseId, vendorId)` together, so a forged case id from another party simply returns nothing rather than leaking data. Refund amounts, quantities, and every state transition are computed/validated server-side (`modules/resolutions/policy.ts`) — a client can request an outcome but never set one.
