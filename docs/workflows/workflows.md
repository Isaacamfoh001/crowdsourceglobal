# CrownSourceGlobal — Workflows

Implementation reference for CrownSourceGlobal's end-to-end business workflows. See `/docs/domain/entities.md` for entity fields and `/docs/domain/state-machines.md` for lifecycle detail.

## Purchasing Paths

CrownSourceGlobal supports three distinct, deliberately separate purchase paths:

| Path | Trigger | Pricing | Workflow(s) |
|---|---|---|---|
| **A — Standard purchase** | Customer selects an existing VendorListing and quantity | Live catalogue price at checkout revalidation | A, B |
| **B — Instant Quotation** | Customer requests a quote for existing VendorListing(s) whose pricing is fully deterministic (bulk tiers) | Server-computed from live BulkPriceTier/VendorCostRule, snapshotted at issuance | C, Q |
| **C — Custom Sourcing** | Customer has a requirement that cannot be priced deterministically from the catalogue at all | Staff-prepared commercial offer, following human sourcing/allocation work | R |

All three converge on the same Order/Payment/Fulfilment machinery from the point a Quotation is accepted (Instant) or a custom Quotation is accepted (Custom Sourcing) — neither introduces a parallel checkout or payment path. Custom Sourcing must never be confused with Instant Quotation: Instant Quotation exists specifically because pricing is already fully known; Custom Sourcing exists specifically because it is not.

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

## C. Bulk / Instant Quotation Purchase *(implemented M5 — see Workflow Q for full detail)*

Listing + quantity → Pricing evaluates tier → Quotation (instant) issued → checkout consumes the Quotation directly (no revalidation of price, since it's already authoritative — availability IS revalidated at this step) → `PENDING_PAYMENT` Order copies Quotation terms → Payment → CONFIRMED → Fulfilment.

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

## N. Domestic Fulfilment & Collection *(added M4)*

```
Payment confirmed → Fulfilment created (origin = DOMESTIC_COLLECTION, Shipment CREATED)
  → Vendor notified ("new order")
  → Vendor: Start Preparing (PENDING → PREPARING)
  → Vendor: Mark Ready for Collection (PREPARING → READY)
  → Admin: schedule collection (carrier/reference/date on the Shipment — informational only, no status change)
  → Admin: confirm collected (Shipment CREATED → COLLECTED, collectedAt/collectedByUserId; Fulfilment → DISPATCHED)
  → Admin: progress Shipment COLLECTED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
  → Fulfilment → DELIVERED (system, mirrors Shipment)
  → Customer sees each step on their order tracking timeline; may optionally confirm receipt (a side signal only)
```

The Vendor never sees the customer's delivery address — only their own registered pickup details (Vendor.pickupAddressLine1/pickupContactName/pickupContactPhone/pickupHours/pickupNotes, private, editable in the Vendor Portal). The customer's delivery address is only ever read by CrownSource operations (via `Order.deliveryInfo`), never copied onto the Fulfilment/Shipment record itself.

## O. International Inbound Fulfilment *(added M4)*

```
Payment confirmed → Fulfilment created (origin = INTERNATIONAL_INBOUND)
  → Shipment auto-created, receivingLocationId defaulted to the oldest active ReceivingLocation
    (or left unassigned if none exists yet — Admin must assign one before the vendor can ship)
  → Vendor notified, sees the assigned receiving destination on their order detail page
  → Vendor: Start Preparing → Mark Ready to Ship (same PENDING→PREPARING→READY transitions as domestic)
  → Vendor: records outbound shipment (carrier, tracking reference, ship date, expected arrival)
    — this is the ONE case where a Vendor moves Fulfilment READY → DISPATCHED themselves
  → Admin: confirms CrownSource receipt (Shipment CREATED → COLLECTED, receivedAt/receivedByUserId,
    receivingLocationId reconfirmed) — the Vendor cannot perform this step
  → Same onward Shipment progression as domestic (COLLECTED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED)
  → Customer-facing copy uses plain-language steps ("On the way to CrownSource" / "Received for local
    delivery") rather than exposing the internal freight state machine directly
```

Customs/duties/import-freight costs are explicitly out of scope for M4 — the data model isn't blocked from representing them later (e.g. an OrderItem-level adjustment or a future `PayoutAdjustment`-style mechanism), but nothing is calculated or invented now.

## P. Fulfilment Issue / Operational Exception *(added M4)*

A Vendor may report a problem (can't fulfil the quantity, item unavailable, preparation delay, damaged stock) any time before their Fulfilment leaves their hands (PENDING/PREPARING/READY only — not after DISPATCHED, which is no longer their responsibility). This creates a `FulfilmentIssue(OPEN)` and moves `Fulfilment.status → EXCEPTION`, pausing it. CrownSource operations resolves it with a note (visible to the Vendor) which resumes the Fulfilment to PREPARING. This never touches OrderItem, quantities, or payment amounts — it is an operational pause/resume mechanism only, not a refund or replacement workflow (those remain a later milestone).

## Q. Instant Bulk Quotation *(added M5)*

```
Customer selects a bulk quantity on an eligible listing ("Get Instant Quote")
  → signed out? selection is stashed in an HttpOnly cookie, customer sent to
    sign-in, then resumed as an explicit prompt on return (never auto-added)
  → line added to a cookie-held Quote Draft (NOT a persisted DRAFT row —
    nothing commercial exists yet; see entities.md)
  → Customer may add more eligible listings — from ANY vendor, customer-
    selected, never auto-split — adjust quantities, or remove lines
  → "Generate Quote": every line is re-validated fresh server-side
    (approval/active/MOQ/maxOq) and priced fresh from live
    BulkPriceTier/VendorCostRule — nothing about the draft cookie is trusted
  → Quotation + QuotationItems created, already ISSUED, expiresAt =
    now + QUOTE_VALIDITY_DAYS (lib/env.ts) — inventory is NOT reserved here
  → Customer views the quote (/account/quotes/[id]) — pricing shown is
    always the immutable snapshot, never re-derived from current pricing
  → "Proceed to Checkout": ordersService.createOrderFromQuotation
    atomically claims the Quotation (ISSUED → ACCEPTED, idempotent via
    Order.originQuotationId's unique constraint), revalidates availability
    with the same atomic conditional-decrement as cart checkout (Workflow G),
    and copies OrderItem values VERBATIM from the QuotationItem snapshot —
    no new pricing evaluation happens at this step
  → PENDING_PAYMENT Order (multiple OrderItems, possibly multiple vendors)
    → existing MockPaymentProvider → CONFIRMED → Fulfilments fan out per
      vendor exactly as Workflow B/E already do — no parallel commerce path
```

If availability has dropped below the quoted quantity by acceptance time, the whole acceptance transaction rolls back: the Quotation reverts to ISSUED (never left stuck ACCEPTED with no Order), its price is untouched, and the customer sees a clear message with a path to request an updated quote (which re-validates everything from scratch — it never reuses the old snapshot's prices). An expired Quotation remains permanently viewable as a historical artifact but can never be accepted; expiry is derived at read time from `expiresAt` rather than a background sweep, and acceptance independently re-checks it, so correctness never depends on a scheduler running.

## R. Custom Sourcing & Managed Procurement *(added M6)*

```
Customer submits a requirement CrownSourceGlobal cannot price from the
catalogue ("500 custom embroidered polo shirts") — title, description,
quantity, optional specifications/deadline/budget/attachments
  → CustomSourcingRequest created, already SUBMITTED (no persisted DRAFT —
    same reasoning as M5's Quotation), customer + all staff notified
  → Staff: Under Review → Sourcing
  → Staff privately curates SourcingOptions — existing marketplace Vendor,
    a Vendor with no matching public listing, or an off-platform external
    supplier (never exposed to the customer, never a public bidding
    mechanism — CrownSource operations decides who to approach)
  → Staff allocates the request's quantity across chosen options
    (SourcingAllocation, cost/lead-time/origin snapshotted at allocation
    time) — sum of allocations must equal the request's quantity before a
    quote may be issued; a partial allocation cannot silently produce a
    full-quantity quote
  → [optional] Staff requests clarification — Sourcing → Awaiting Customer,
    a staff-initiated message on the request's Customer↔CrownSource
    conversation (reusing M3 messaging entirely; the customer is never
    given contact with any Vendor/supplier at any point) — customer
    replies, staff resumes: Awaiting Customer → Sourcing
  → Staff prepares the commercial offer: a customer-facing description +
    unit price (staff-set, not a computed markup formula), covering the
    full request quantity as ONE line — never "300 from Supplier A, 200
    from Supplier B" shown to the customer
  → quotationService.issueCustomSourcingQuote (M5's Quotation
    architecture, origin = CUSTOM_SOURCING, sourcingRequestId set,
    QuotationItem.listingId always null, QuotationItem.vendorId populated
    ONLY when every allocation traces to one marketplace Vendor — purely
    to drive automatic Fulfilment creation later, and masked back to null
    on every customer-facing view regardless) → Request → QUOTED, customer
    notified
  → Customer may keep discussing via the same conversation before
    deciding — nothing about discussion mutates the issued Quote
  → If terms change: Staff reissues — old Quotation → SUPERSEDED, new
    Quotation → ISSUED (supersedesQuotationId links them), both preserved;
    Request stays QUOTED throughout
  → Customer accepts the Quote exactly as in Workflow Q:
    ordersService.createOrderFromQuotation — custom lines skip the
    catalogue-availability check entirely (there is no live VendorListing
    stock behind a staff-curated allocation; the commercial commitment was
    already locked in at quote issuance) — Request → ACCEPTED, atomically
    with Order creation, in the same transaction
  → PENDING_PAYMENT Order → existing MockPaymentProvider → CONFIRMED
  → Fulfilment fan-out (confirmOrderPayment, entirely unmodified):
    a single-vendor-sourced line's OrderItem.vendorId is populated, so a
    normal Fulfilment is created automatically, exactly like any other
    Vendor order; a mixed or externally-sourced line's OrderItem.vendorId
    is null, so NO Fulfilment is auto-created for it — CrownSource
    operations manages that inbound-procurement leg manually via the
    SourcingAllocation records already visible on the admin sourcing
    workspace (the "smallest correct integration" — no fake Vendor
    account is ever created to force external supply through Fulfilment)
```

CrownSource operations is the sole intermediary throughout: Customer ↔ CrownSourceGlobal ↔ Supplier/Vendor, never Customer ↔ Supplier. There is no self-serve "any Vendor can bid on this request" mechanism — this is not a public marketplace RFQ. Customs/duties/import-freight costs and AI-driven sourcing automation are both explicitly out of scope for M6, per the same reasoning as M4's customs deferral.
