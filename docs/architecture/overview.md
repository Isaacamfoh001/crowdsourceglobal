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
| Notifications | One-way system events, multi-channel |
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
| Email | Resend or Postmark | Provider choice deferred |
| In-app notifications | DB-backed table, polling | No real-time channel in V1 |
| Background jobs | DB-backed job table + polling worker | No broker |
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
  /notifications
  /administration             permission/policy surface, no duplicated business logic
  /audit
  # each module: service.ts, repository.ts, policy.ts (authorization), types.ts, *.test.ts
/prisma                      schema.prisma, migrations
/lib                          shared infra: db client, session/auth helpers, storage client,
                              email client, job runner
/jobs                         background job definitions + worker entrypoint
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

## Security Summary

Full detail in `/docs/workflows/workflows.md` and the decision records; the headline mechanisms:

- Customer/vendor isolation enforced at the repository layer via session-derived scoping, never UI hiding.
- Client never supplies price; authoritative pricing is always server-derived (checkout revalidation) or copied from a server-issued Quotation.
- Inventory reservation is atomic with `PENDING_PAYMENT` Order creation, preventing oversell under concurrent checkouts.
- Payment webhooks are signature-verified and idempotent on the provider's event id.
- Fulfilment creation and payout claiming are idempotent via database uniqueness constraints, not application-level locking alone.
- Every domain service emits an `AuditEvent` inline with its own state-changing transaction.
