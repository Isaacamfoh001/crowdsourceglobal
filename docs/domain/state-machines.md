# CrownSourceGlobal — State Machines

Authoritative states and legal transitions for the entities whose lifecycle matters to correctness. See `/docs/domain/entities.md` for the fields these states live on.

| Entity | States (→ = transition) | Terminal | Triggered by | Idempotency note |
|---|---|---|---|---|
| **Vendor Verification** | PENDING → UNDER_REVIEW → APPROVED \| REJECTED → (resubmit) PENDING | APPROVED, REJECTED (soft) | Vendor (submit), Admin (approve/reject) | — |
| **Vendor Listing** | DRAFT → PENDING_REVIEW → APPROVED → ACTIVE ⇄ INACTIVE; APPROVED → CHANGES_REQUESTED → PENDING_REVIEW; → REJECTED → (edit) PENDING_REVIEW; → ARCHIVED | ARCHIVED | Vendor (create/edit/toggle), Admin (approve/reject/request changes) | — |
| **Quotation** | DRAFT (internal, custom only) → ISSUED → ACCEPTED \| EXPIRED \| WITHDRAWN \| SUPERSEDED | ACCEPTED, EXPIRED, WITHDRAWN, SUPERSEDED | System (issue/expire), Customer (accept), Admin (withdraw/supersede) | Unique constraint: one Order per Quotation — ACCEPTED cannot fire twice |
| **Custom Sourcing Request** | SUBMITTED → UNDER_REVIEW → SOURCING → QUOTED → (resolved via linked Quotation) \| CLOSED_NO_QUOTE \| CANCELLED | CLOSED_NO_QUOTE, CANCELLED, or implicitly resolved once the linked Quotation is ACCEPTED | Customer (submit/cancel), Admin (review/source/quote/close) | — |
| **Order** (fulfilment track) | PENDING_PAYMENT → CONFIRMED → FULFILLING → COMPLETED \| CANCELLED (only from PENDING_PAYMENT or pre-fulfilment) | COMPLETED, CANCELLED | System (payment webhook → CONFIRMED; all Fulfilments COMPLETED → COMPLETED) | `Order.paymentStatus` is tracked on a **separate** field (UNPAID/PAID/PARTIALLY_REFUNDED/REFUNDED) to avoid a combinatorial status explosion — a COMPLETED order can still carry a REFUNDED paymentStatus |
| **Payment** | INITIATED → PENDING → SUCCEEDED \| FAILED | SUCCEEDED, FAILED | System (initiate), Provider webhook (confirm/fail) | Provider event id unique constraint |
| **Refund** | REQUESTED → PROCESSING → COMPLETED \| FAILED (retry = new record) | COMPLETED, FAILED | Admin (request), Provider webhook (confirm) | New Refund record per attempt, never reused |
| **Fulfilment** | PENDING → ACCEPTED → PREPARING → READY → DISPATCHED → DELIVERED → COMPLETED; ⇄ EXCEPTION; → CANCELLED | COMPLETED, CANCELLED | Vendor (accept/prepare/ready/dispatch), System/Admin (deliver confirm, exception, complete) | Creation is idempotent per Order-confirmation event, not per vendor — since multiple Fulfilments per vendor per Order are legal, vendor-scoped uniqueness cannot be the dedup key. Use a flag/event record on the Order marking "Fulfilments already created for this confirmation." |
| **Shipment/Delivery** | CREATED → DISPATCHED → (IN_TRANSIT) → DELIVERED \| FAILED_DELIVERY (re-attempt updates the same record — no live courier API in V1) | DELIVERED | Vendor/Admin manual status update | — |
| **FulfilmentItem payout eligibility** | NOT_ELIGIBLE → ELIGIBLE → ON_HOLD ⇄ ELIGIBLE → CLAIMED | CLAIMED | System (Fulfilment reaches COMPLETED), Admin (hold/release), PayoutRun (claim) | Unique constraint: one claim per FulfilmentItem, ever |
| **PayoutRun** | DRAFT → PROCESSING → PAID \| FAILED (retry = new run) | PAID, FAILED | System (scheduled batch), Admin (manual trigger/mark paid) | New PayoutRun per attempt |

## Notes

- **FulfilmentItem has no independent full state machine** in V1 — its parent Fulfilment carries the primary status, avoiding overbuilt granularity where it isn't needed yet.
- The **payout eligibility trigger** (COMPLETED vs. DELIVERED) is an open business-policy item — see the "must resolve" list in the architecture decision history; the mechanism above works correctly regardless of which trigger is chosen.
- **Refund/payout interaction** across these state machines is detailed in `/docs/workflows/workflows.md` (Workflow K) and ADR 0005.
