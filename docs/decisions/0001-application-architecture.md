# ADR 0001: Application Architecture — Modular Monolith on Next.js

## Context

CrownSourceGlobal needs a single production application architecture that supports a commerce-first marketplace with four distinct experiences (public, customer, vendor, admin), strong domain boundaries (Order/Fulfilment, Payment/Payout, etc.), and a small initial engineering team. CLAUDE.md and PROJECT.md both direct against defaulting to microservices, Kubernetes, message brokers, or split deployments without a concrete justification.

## Options Considered

1. **Single full-stack modular monolith** (Next.js, one deploy unit). Domain logic in framework-agnostic `/modules`, called directly by route handlers/server actions and server-rendered pages.
2. **Modular monolith, split frontend (Next.js) + backend API service** (e.g., NestJS/Express). Same domain-module structure, exposed only via a network API boundary.
3. **Decomposition by domain into separate services** (a payments service, an orders service, etc.).

## Decision

**Option 1 — single full-stack Next.js application, modular monolith.**

## Rationale

| Criterion | Option 1 | Option 2 | Option 3 |
|---|---|---|---|
| Complexity | Lowest | Medium (two deploys, API versioning, cross-origin auth) | Highest |
| Dev speed (small team) | Fastest — one repo, shared types | Slower — duplicate types or a shared-package build step | Slowest |
| Security | Session cookie stays first-party; simplest CSRF story | Cross-origin auth adds real CSRF/token-handling surface | Multiplies webhook/auth surface per service |
| Data integrity | One DB, real cross-domain transactions | Same DB, but two codebases must agree on transaction boundaries | Cross-service transactions become distributed-transaction problems |
| Operational cost | Lowest | Higher | Highest |
| Future evolution | Routes are thin wrappers over `/modules`, so exposing a stable `/api/v1` later is additive | Already has an API, but not worth the ongoing cost now | N/A — no current need |

No concrete problem in this product (team size, request volume, independent-scaling needs) justifies Option 2 or 3 at this stage, per CLAUDE.md §6's justification pattern.

## Consequences

- Domain modules under `/modules` must remain framework-agnostic (no Next.js imports) so a future API/mobile-client extraction is additive, not a rewrite.
- Background/async work uses a database-backed job table with a polling worker process rather than a message broker — the one legitimate second deployment unit in this architecture (the worker), not a second application.
- Revisit this decision only if a concrete, demonstrated problem emerges (e.g., a genuinely independent scaling need for one domain), per CLAUDE.md §6.
