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
| Vendor Payouts | Pays vendors, computed from historical Fulfilment economics |
| Documents | Thin layer generating artifacts from immutable snapshots |
| Messaging | Contextual two-way conversation, two shapes only (Customer↔CSG, CSG↔Vendor) |
| Notifications | Domain event → in-app record → (optionally) queued email, decoupled from every other domain — `modules/notifications` (implemented M7) |
| Administration | Permission/operational surface over other domains — not a parallel business-logic layer |
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
| Payments | Provider-agnostic interface, implemented against Paystack first (Ghana MoMo + card) | Confirm via live testing before committing — see the product requirement in PROJECT.md §54.5 |
| Email | `EmailProvider` interface (`lib/email-provider.ts`); `ConsoleEmailProvider` (zero-config dev default) or `ResendEmailProvider` (plain `fetch` against Resend's API, no SDK dependency) selected via `EMAIL_PROVIDER` | Resend chosen M7 — transactional focus, simple HTTP API, no infra to run. Fails fast at startup if `EMAIL_PROVIDER=resend` without `RESEND_API_KEY`/`EMAIL_FROM` |
| In-app notifications | `Notification` table (`modules/notifications`), persisted synchronously in the same call as the domain event, independent of email | Implemented M7. No real-time channel in V1 — see "Future Realtime Path" below |
| Background jobs | `EmailDeliveryJob` table + polling drain (`lib/email-worker.ts`, `scripts/process-email-jobs.ts`) | Implemented M7 for email delivery specifically — a dedicated table, not a generic `BackgroundJob`, since email is the only async job type that exists today (see "Notifications & Email Delivery" below for why) |
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
    /webhooks/payments        payment provider webhook endpoint(s)
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
  /payments
  /payouts
  /documents
  /messaging
  /notifications              types, policy (required-vs-optional email), links (deep-link builders),
                               repository, service — implemented M7
  /administration             permission/policy surface, no duplicated business logic
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

## Security Summary

Full detail in `/docs/workflows/workflows.md` and the decision records; the headline mechanisms:

- Customer/vendor isolation enforced at the repository layer via session-derived scoping, never UI hiding.
- Client never supplies price; authoritative pricing is always server-derived (checkout revalidation) or copied from a server-issued Quotation.
- Inventory reservation is atomic with `PENDING_PAYMENT` Order creation, preventing oversell under concurrent checkouts.
- Payment webhooks are signature-verified and idempotent on the provider's event id.
- Fulfilment creation and payout claiming are idempotent via database uniqueness constraints, not application-level locking alone.
- Every domain service emits an `AuditEvent` inline with its own state-changing transaction.
- Notification read/list/mark-read queries are always scoped by session-derived `recipientUserId`; `targetUrl` deep links are built server-side from known route shapes (`modules/notifications/links.ts`), never from a client value or a request Host header — no open-redirect surface.
