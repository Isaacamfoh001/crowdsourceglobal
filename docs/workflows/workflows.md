# CrownSourceGlobal — Workflows

Implementation reference for CrownSourceGlobal's end-to-end business workflows. See `/docs/domain/entities.md` for entity fields and `/docs/domain/state-machines.md` for lifecycle detail.

## Commercial Snapshot Timing

```
STANDARD (Cart) PATH
Cart (informational)
  → checkout revalidation (live Listing price/availability/tier + Pricing's cost+margin rule)
  → PENDING_PAYMENT Order + OrderItems created
       ⤷ OrderItem is the FIRST point where economics become authoritative:
         customer unit price, vendor-payable basis, both captured here
  → Payment → webhook confirms
  → Order → CONFIRMED
  → Fulfilment + FulfilmentItems created
       ⤷ FulfilmentItem COPIES its economics from the already-fixed OrderItem —
         it performs no new pricing evaluation and does not exist before this step

QUOTATION-ORIGIN PATH
Quotation issued (customer price + vendor-payable basis locked at ISSUANCE)
  → accepted → Order + OrderItems created, copying Quotation terms verbatim (no re-pricing)
  → Payment → webhook confirms → Order CONFIRMED
  → Fulfilment + FulfilmentItems created, copying from OrderItem (same as standard path)
```

**Source of truth by stage:** Quotation is authoritative for its own terms from issuance until consumed. OrderItem becomes authoritative for a given Order's economics the moment `PENDING_PAYMENT` is created — either freshly derived (standard path) or copied verbatim (quotation path). FulfilmentItem is never independently authoritative — it always copies its parent OrderItem's already-fixed values at Fulfilment-creation time.

## Custom Sourcing: Customer View vs. Internal Allocation

`OrderItem.vendorId` is nullable: populated when the customer explicitly picked a vendor listing (ordinary shopping), null when the line is a custom-sourcing aggregate (e.g., "Branded Notebooks × 1,000, GH₵X total") with no single vendor exposed to the customer. `FulfilmentItem.vendorId` is always populated. One OrderItem can fan out to multiple vendor-specific FulfilmentItems — the same mechanism that supports partial/split fulfilment also covers CrownSourceGlobal's internal multi-vendor sourcing allocation, recorded via `SourcingAllocation` during the admin sourcing process and copied forward at Order confirmation.

## A. Standard Single-Vendor Purchase

Listing → Cart → checkout revalidation → `PENDING_PAYMENT` Order/OrderItem (1 vendor) → Payment → CONFIRMED → 1 Fulfilment/FulfilmentItem → Notify → Document (receipt).

## B. Standard Customer-Selected Multi-Vendor Purchase

Same as A, but Cart holds items across N vendor Listings → checkout produces N OrderItems (each `vendorId` populated) → Order CONFIRMED spawns N Fulfilments, one per distinct vendor. No allocation logic exists — the customer's line items are the allocation.

## C. Bulk / Instant Quotation Purchase

Listing + quantity → Pricing evaluates tier → Quotation (instant) issued → checkout consumes the Quotation directly (no revalidation, since it's already authoritative) → `PENDING_PAYMENT` Order copies Quotation terms → Payment → CONFIRMED → Fulfilment.

## D. Custom Sourcing → Quotation → Order

Request submitted → admin SOURCING creates `SourcingAllocation`(s) across vendors → custom Quotation issued with `vendorId = null` line items → customer accepts → Order/OrderItem (`vendor = null`) created → Fulfilments fan out per SourcingAllocation → Payment/CONFIRMED as usual.

## E. Payment Confirmation

Payment INITIATED at checkout → provider redirect/SDK flow → provider webhook (signature-verified) → Payment SUCCEEDED (idempotent on `providerEventId`) → Order `paymentStatus = PAID`, `status → CONFIRMED` → Fulfilment-creation job enqueued. **A frontend redirect/success page is never treated as authoritative confirmation.**

## F. Failed / Abandoned Payment

Payment FAILED, or no webhook received within timeout → background sweep marks Order CANCELLED → InventoryReservation released → customer notified, may retry checkout (a new Order).

## G. Inventory Reservation / Release

Reservation created in the same DB transaction as the `PENDING_PAYMENT` Order (atomic check-and-decrement). On Payment SUCCEEDED, reservation → `committed`. On FAILED/timeout, reservation → `released`, quantity restored. A background sweep enforces `expiresAt` for reservations that never reach a terminal payment state.

## H. Fulfilment and Partial Shipment

Fulfilment PENDING → ACCEPTED → PREPARING → READY → DISPATCHED (vendor-driven) → one or more Shipments created against it (partial dispatch splits FulfilmentItem quantity across Shipments) → DELIVERED per Shipment → Fulfilment COMPLETED once all its Shipments are DELIVERED.

## I. Delivery Completion

Last Shipment on a Fulfilment reaches DELIVERED → Fulfilment → COMPLETED → its FulfilmentItems → ELIGIBLE for payout → once all of an Order's Fulfilments are COMPLETED, Order → COMPLETED.

## J. Vendor Payout

Scheduled job claims ELIGIBLE, non-held FulfilmentItems per vendor → PayoutRun DRAFT → PROCESSING, PayoutItems created (unique per FulfilmentItem, ever) → any pending PayoutAdjustments are netted in → PROCESSING → PAID (manual bank transfer marked by admin in V1; a provider transfer API can replace this later without changing the model) → vendor notified.

## K. Cancellation / Refund

| Case | Mechanism | Business policy needed? |
|---|---|---|
| Refund before fulfilment | Payment refunded; Order → CANCELLED; no FulfilmentItem ever reaches ELIGIBLE | No |
| Refund after fulfilment, before payout | FulfilmentItem stays ELIGIBLE by default (vendor did the work). Admin may set `payoutHold = true` if the refund reason is vendor-fault, excluding it from the next PayoutRun | **Yes** — who decides "vendor fault"; the mechanism works either way |
| Refund after vendor payout | A negative `PayoutAdjustment` is created against the Vendor + original FulfilmentItem, netted against that vendor's *next* PayoutRun. No reverse-transfer is attempted | Yes — recovery policy (net-off vs. direct reclaim) is a business call |
| Partial refund | Ties to specific OrderItem quantities; reduces eligible amount pre-payout, or creates a proportional `PayoutAdjustment` post-payout | No — mechanical once the above policies exist |
| Cancelled order | Inventory reservation released; no Fulfilment/Payout ever created | No |
| Payout hold | `FulfilmentItem.payoutHold` + reason, admin-settable, excludes it from PayoutRun claiming until cleared | No |
| Payout eligibility | ELIGIBLE when Fulfilment status = COMPLETED **and** no active hold **and** not already claimed | Partial — exact trigger (COMPLETED vs. DELIVERED) is an open business decision |

There is deliberately no full accounting ledger — `payoutHold` and `PayoutAdjustment` are the complete mechanism. See ADR 0005.

## L. Buyer → CrownSource Messaging

`Conversation(participantType = customer, context = product|order|quotation|custom_request|storefront|general)` created from the relevant trigger → Messages exchanged, always with CrownSourceGlobal as the counterparty, never a Vendor.

## M. Vendor → CrownSource Messaging

`Conversation(participantType = vendor, context = fulfilment|general)` — an operationally separate thread, never merged with any customer thread on the same Order.
