# ADR 0004: Payment vs. Order Creation Sequencing

## Context

The relationship between checkout, payment, and Order creation must be decided explicitly, since it governs idempotency, retry behavior, abandoned-payment handling, and inventory reservation correctness. A frontend redirect/success page must never be treated as authoritative payment confirmation (CLAUDE.md §10).

## Options Considered

**Model A.** Checkout → payment succeeds → Order created.

**Model B.** Checkout → `PENDING_PAYMENT` Order created → payment attempted → provider webhook confirms → Order becomes `CONFIRMED` → Fulfilments become actionable.

## Decision

**Model B.**

## Rationale

- **Idempotency and retries:** the `PENDING_PAYMENT` Order row is a durable anchor that a retried or duplicate webhook can be matched against; Model A has no such anchor until payment succeeds, making duplicate-submission handling harder to reason about.
- **Abandoned payments:** Model B makes an in-progress, uncompleted purchase an explicit, queryable state (`PENDING_PAYMENT`) rather than an ephemeral in-memory step that must be reconstructed for support/observability purposes.
- **Payment succeeds but application processing fails:** because the Order already exists, webhook handling can be retried via the background job system until it successfully transitions the Order to `CONFIRMED` and spawns Fulfilments — nothing is lost, since there is no in-memory post-payment step that could fail invisibly.
- **Inventory:** a soft reservation is taken at `PENDING_PAYMENT` creation with a short expiry, released if payment does not complete in time — see `/docs/workflows/workflows.md` Workflow G. This requires the Order/reservation to exist before payment confirms, which only Model B provides naturally.
- **Quotation checkout:** the same Order-creation step applies uniformly whether the Order originates from a Cart or an accepted Quotation, keeping Checkout's contract simple (see `/docs/workflows/workflows.md`).

## Consequences

- `Order.status` and `Order.paymentStatus` are tracked as separate fields (see `/docs/domain/state-machines.md`) so a `PENDING_PAYMENT` Order that never completes can be cleanly distinguished from a completed Order that is later refunded.
- Fulfilment creation is gated strictly on `Order.status = CONFIRMED`, never on checkout submission alone.
- A background sweep is required to cancel `PENDING_PAYMENT` Orders and release their inventory reservations after a timeout (Workflow F).
