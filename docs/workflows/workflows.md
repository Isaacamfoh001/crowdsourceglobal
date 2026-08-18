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

## E. Payment Confirmation *(real provider implemented M10A — Moolre)*

Payment INITIATED at checkout → provider request → Payment PENDING → provider webhook arrives (trigger only — Moolre documents no signature/HMAC mechanism, only source-IP allowlisting) → CrownSourceGlobal independently calls the provider's own status API using its own credentials → only that verified result can move Payment → SUCCEEDED (guarded, idempotent `updateMany`; N duplicate callbacks/polls produce exactly one winner) → `ordersService.confirmOrderPayment` (the SAME transition mock payments already used — no Moolre-specific confirmation path) → Order `paymentStatus = PAID`, `status → CONFIRMED` → Fulfilments created. **A frontend redirect/success page, and the webhook payload's claimed status alone, are never treated as authoritative confirmation** — see Workflow X.

## F. Failed / Abandoned Payment *(sweep implemented M10A)*

Payment FAILED (provider-rejected or verified-failed) leaves the Order in `PENDING_PAYMENT`, retryable. Separately, an Order whose `InventoryReservation.expiresAt` has passed with no successful Payment is picked up by `paymentsService.sweepAbandonedPayments()` (`scripts/sweep-abandoned-payments.ts`, run on a schedule — same DB-backed-job model as M7's email worker, no message broker): Order → CANCELLED (guarded, only from `PENDING_PAYMENT`), reservation → `RELEASED`, `availableQuantity` restored. Customer may retry checkout as a new Order. This sweep was designed at the architecture-planning stage but never had a real trigger until M10A introduced a genuinely asynchronous payment provider — the old synchronous mock flow always resolved before a reservation could expire.

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

**M9 implementation note:** this table described the mechanism during architecture planning, before any code existed. M9 is its first real implementation — `resolutionsService.approveResolution()` is what actually sets `payoutHold` (row 2, "vendor-fault" decided via the case's `responsibility` field), and inventory-reservation release (row 5) is Workflow U above. `PayoutAdjustment` (row 3) remains unbuilt — nothing has been paid out yet (no `PayoutRun` exists until M11), so there is nothing yet to net a correction against. Refund creation/approval/execution itself is Workflows T/V above, not this table.

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

## S. Notifications & Email Delivery *(added M7)*

```
Domain transition commits (e.g. vendorApplicationsService.approve())
  → await notificationsService.notify({recipientUserId, type, title, body,
      targetUrl, eventKey, email?}) — a fast local DB write, not a slow
      external call, so every caller awaits it (unlike the old per-module
      notifySafely(() => sendXEmail(...)) fire-and-forget pattern it replaced)
  → Notification row created (always, in-app) — dedup on
    (recipientUserId, eventKey): a retried callback/double-click/duplicate
    webhook produces at most one row, safely, via a caught P2002
  → if `email` was passed AND the type's policy allows it for this
    recipient's preferences (REQUIRED types always do; the three optional
    categories respect NotificationPreference): EmailDeliveryJob created
    in the same transaction as the Notification, status PENDING
  → notify() returns — the domain transition's own success/failure was
    NEVER contingent on any of the above; a notifications-table hiccup is
    caught and logged, never propagated
  → separately, asynchronously: processEmailQueue() drains eligible jobs
    (claim → render template → provider.send → mark SENT, or mark FAILED
    with bounded backoff) — triggered as a fire-and-forget dev-convenience
    kick right after notify(), AND by scripts/process-email-jobs.ts on a
    real schedule in production; neither call path is the source of
    delivery correctness — the persisted, durably-claimed job row is
  → recipient sees the in-app notification via the bell/notification
    center immediately regardless of email outcome; if the email send
    succeeds, they also receive it in their inbox
```

**Multi-role recipients.** A User who is simultaneously a Customer, a Vendor owner, and a SUPER_ADMIN receives every notification addressed to their `User.id` in one stream, correctly routed by `targetUrl` to the right portal for each event — a customer-facing order confirmation links into `/account/...`, a vendor-facing new-order event links into `/vendor/portal/...`, an admin-facing event links into `/admin/...`. Two genuinely distinct events (e.g. "your order was confirmed" as the customer, "you have a new order" as the vendor owner) both appear; they are never collapsed into each other. Only a true retry of the *same* event, for the same recipient, collapses via the `eventKey` dedup.

**What is NOT built.** No WebSocket/SSE transport, no typing/presence/read-receipts, no push notifications, no email delivery-status webhooks (accepted/delivered/bounced/complained) — the `EmailDeliveryJob`/provider boundary is a clean integration point for these later, but none is wired in V1. See `/docs/architecture/overview.md`'s "Notifications & Email Delivery" section for the provider abstraction, dedup mechanism, and the deliberate auth-email exception (verification/password-reset stay direct, not routed through this workflow).

## T. Post-Purchase Resolution — Case Lifecycle *(added M9)*

```
Customer opens an eligible Order → "Report a problem" / "Request cancellation"
  → picks issue type + affected item(s)/quantity + description (+ optional
    evidence) → resolutionsService.submitCase validates ownership, quantity
    caps, and (for cancellation) that the Fulfilment hasn't already been
    delivered → ResolutionCase created, status OPEN, customer + all admins
    notified (RESOLUTION_CASE_RECEIVED / ADMIN_NEW_RESOLUTION_CASE)
  → Staff: Start review (OPEN → UNDER_REVIEW)
  → [optional] Staff requests customer clarification (→ AWAITING_CUSTOMER) —
    reuses M3 messaging via a RESOLUTION_CASE-context Customer↔CrownSource
    conversation; customer replies; staff resumes (→ UNDER_REVIEW)
  → [optional] Staff requests vendor input (→ AWAITING_VENDOR) — a SEPARATE
    Vendor↔CrownSource conversation, same case, structurally distinct thread;
    vendor never sees the customer conversation or contact details; vendor
    replies; staff resumes (→ UNDER_REVIEW)
  → Staff decides: per affected line, an approvedResolution (NO_ACTION,
    FULL_REFUND, PARTIAL_REFUND, REPLACEMENT, RETURN_AND_REFUND,
    RETURN_AND_REPLACEMENT, REDELIVERY), server-validated against what
    remains refundable/resolvable for that OrderItem across every case that
    has ever touched it — never a client-submitted total
  → resolutionsService.approveResolution (ONE transaction): case →
    RESOLUTION_APPROVED; creates a Refund (already APPROVED, amount =
    server-computed sum) if any line is refund-bearing; creates a Return
    (APPROVED) if any line requires one; creates a Replacement record per
    replacement line; sets FulfilmentItem.payoutHold if responsibility =
    VENDOR; cancels the named Fulfilment (+ releases its inventory
    reservation) if this was an approved cancellation — customer notified
    with the plain-language decision reason
  → [if refund-bearing, no return required] Staff processes the refund via
    modules/refunds/mockExecutor.ts (mock — no real money moves) → COMPLETED
    or FAILED (retryable, claim-guarded so it can never execute twice)
  → [if return required] see Workflow V below — refund is NOT processed
    until the return reaches INSPECTED
  → [if replacement] see Workflow W below
  → Staff: Mark resolved (RESOLUTION_APPROVED/RESOLUTION_IN_PROGRESS →
    RESOLVED, customer + any involved vendor notified) → Close (→ CLOSED)
```

Alternative path: Staff rejects at any point before approval (`REJECTED`, with a customer-safe reason) — no refund/return/replacement side effects fire.

## U. Cancellation Eligibility & Inventory Restore *(added M9)*

```
Customer requests cancellation on a specific Fulfilment
  → modules/resolutions/policy.ts classifies eligibility from the
    Fulfilment's CURRENT status (a hint, not a gate — every cancellation
    still goes through the same staff approval as any other case):
      PENDING            → SAFE (vendor hasn't started)
      PREPARING/READY/
      DISPATCHED         → NEEDS_REVIEW (already in motion)
      DELIVERED+         → BLOCKED at submission — case creation itself is
                            rejected; the customer is redirected to the
                            report-a-problem/return flow instead
  → Staff approves with cancelFulfilmentId set → Fulfilment.status →
    CANCELLED (guarded: only from PENDING/PREPARING/READY, re-checked
    server-side even if the eligibility hint said SAFE earlier) →
    InventoryReservation → RELEASED → VendorListing.availableQuantity
    incremented back by the cancelled quantity
```

A damaged-item refund with **no** cancellation touches inventory not at all — the goods physically exist and were delivered; there is nothing to restock. Restocking only ever happens via this cancellation path or via Workflow V's return-inspection outcome — never automatically from a refund being approved.

## V. Return + Refund Sequencing *(added M9)*

```
Staff approves RETURN_AND_REFUND (or RETURN_AND_REPLACEMENT) for one or
more case lines → Return created, status APPROVED → Refund created
alongside it, status APPROVED, but NOT processed yet — the refund is a
recorded decision; execution deliberately waits for inspection
  → Staff records return transit (method + optional tracking reference) →
    IN_TRANSIT
  → Staff confirms CrownSource received the item → RECEIVED
  → Staff inspects → INSPECTED, with an outcome:
      RESELLABLE     → inventory restocked (VendorListing.availableQuantity
                        incremented), Return.restockedAt set — guarded so
                        this can only ever happen once per Return
      NOT_RESELLABLE → no restock
  → Staff processes the already-approved Refund via the mock executor →
    COMPLETED
  → Staff marks the Return COMPLETED (informational close-out)
```

A resolution that does NOT require physical goods to move back (e.g. a straightforward damaged-item refund where CrownSource doesn't need the item returned) skips this entirely — staff simply doesn't choose a RETURN_* decision, and the refund processes immediately after approval (Workflow T). The return requirement is always an explicit staff choice per case, never an automatic function of issue type.

## W. Replacement — Reusing M4 Fulfilment Tracking *(added M9)*

```
Staff approves REPLACEMENT (or RETURN_AND_REPLACEMENT) for a case line,
with a replacementQuantity ≤ the line's affected quantity → Replacement
record created (resolutionCaseId, originalOrderItemId, quantity) — no
Fulfilment exists yet
  → Staff: Create replacement order (a separate, explicit action — staff
    controls WHEN the actual replacement work begins)
  → resolutionsService.createReplacementFulfilment:
      - if the original line was listing-backed: atomic conditional
        decrement of VendorListing.availableQuantity (same guarded
        check-and-decrement as ordinary checkout — Workflow G) — fails
        cleanly with a clear error if stock is insufficient
      - a NEW OrderItem is created on the SAME Order: unitPrice = 0,
        lineTotal = 0, vendorPayableBasis = 0 (no fake customer charge;
        the original commercial record is completely untouched)
      - a Fulfilment + FulfilmentItem + Shipment are created for it, using
        the EXACT SAME construction shape confirmOrderPayment already uses
        for a normal order (modules/orders/service.ts's per-vendor fan-out)
      - Vendor notified (VENDOR_NEW_ORDER — the same notification a real
        new order gets, since operationally it is one)
  → The replacement Fulfilment progresses through the ordinary
    PENDING → PREPARING → READY → DISPATCHED → DELIVERED lifecycle
    (Workflow H/N, entirely unmodified) — visible in the SAME vendor
    portal Operations pages and the SAME customer order-tracking UI. No
    separate replacement-tracking UI exists or is needed.
```

Replacement source is always the same Vendor as the original line in V1 (`originalOrderItem.vendorId`) — alternate-vendor or CrownSource-custom-source replacement is an explicitly deferred follow-up (M9 spec §25), not built now.

## X. Ghana Mobile Money Payment *(added M10A — Moolre; Paystack made primary M10A.2)*

```
Customer submits network (MTN/AirtelTigo/Telecel) + phone — amount/
currency are ALWAYS server-derived from the immutable, already-confirmed
Order total, never trusted from the browser
  → paymentsService.initiateMobileMoneyPayment:
      - normalizes phone to the active provider's documented format
        (raw phone is never persisted — only a masked form)
      - generates CrownSourceGlobal's own reference (PAY-YYYYMMDD-XXXXX),
        which doubles as the provider's own reference/idempotency key —
        created once, never regenerated for the same attempt
      - Payment row created (status INITIATED, provider = whichever real
        provider is active — Paystack by default); a DB-only partial
        unique index allows at most one INITIATED/PENDING Payment per
        Order, closing the double-click/double-tab race at the database
        level
      - calls getActivePaymentProvider().initiate() — Paystack's Charge
        API (POST /charge, provider codes mtn/atl/vod — mapping confined
        to modules/payments/providers/paystack/) or Moolre's Collection
        API (channel codes 13/6/7 — modules/payments/providers/moolre/),
        depending on PAYMENT_PROVIDER
  → Provider response, mapped to one of four outcomes (never raw
    provider codes past the adapter):
      - ACCEPTED  → Payment PENDING, customer sees a "check your phone"
        screen with bounded, CrownSource-server-mediated polling (the
        browser never calls the provider directly). Paystack's
        `pay_offline` status maps here.
      - OTP_REQUIRED → customer enters the SMS code → resubmitted against
        the SAME reference (Paystack: POST /charge/submit_otp {otp,
        reference}; Moolre: same request resubmitted with otpcode added)
        → same ACCEPTED/REJECTED handling. Never a new Payment/reference.
      - REJECTED  → Payment FAILED, customer may retry (a new attempt,
        new reference)
      - UNKNOWN (timeout/network failure) → Payment stays
        PENDING/INITIATED, uncertain — NEVER auto-retried (could double-
        debit); resolved later via polling/reconciliation
  → Resolution always funnels through ONE function
    (applyVerifyOutcome), regardless of trigger or provider:
      - webhook (POST /api/payments/paystack/webhook or
        /api/payments/moolre/webhook) — a TRIGGER only, even for
        Paystack's real HMAC-SHA512-verified webhook (verified once, at
        the route, before any JSON parsing — see ADR 0007). Moolre
        documents no signature mechanism at all; best-effort source-IP
        filtering is applied but never treated as sufficient proof
        (flagged as an open production-risk question — see ADR 0006).
        Either way, the handler ALWAYS independently calls the
        provider's own status/verify API before trusting anything.
      - customer polling (getPaymentStatusForCustomer) — re-verifies
        with the provider only when the last check is stale
      - admin reconciliation (reconcilePaymentAsAdmin) — same
        verification call, explicit, never an unrestricted "mark paid";
        uses whichever provider actually processed THAT Payment, not
        necessarily today's active default
      - amount/currency are checked against the immutable Payment
        record before any confirmation; a mismatch is quarantined via
        `exceptionReason` and a CRITICAL admin notification — never
        confirmed
      - the SUCCEEDED transition is a guarded `updateMany`
        (`status IN (INITIATED, PENDING)`) — N concurrent duplicate
        callers can only ever produce one winner, which then calls the
        SAME `ordersService.confirmOrderPayment` every other payment
        path uses (no provider-specific order-confirmation logic exists)
      - if the verified success arrives after the Order was already
        swept to CANCELLED (Workflow F), the Order is NEVER silently
        reopened — the Payment is marked SUCCEEDED with an
        `exceptionReason` and a CRITICAL admin exception is raised for
        manual resolution instead
```

Refunds: Paystack documents a real, asynchronous Refund API (`POST /refund`, `GET /refund/:reference`) — `PaystackRefundExecutor` (`modules/refunds/paystackExecutor.ts`) uses it. A refund is never marked COMPLETED merely because the create-refund request was accepted; it stays PROCESSING until `resolutionsService.reconcilePaystackRefund` (admin-triggered, or `refund.processed`/`refund.failed` webhook-triggered) independently re-fetches the real status via `GET /refund/:reference` — the webhook body's embedded status is never trusted alone, same discipline as the payment side. Moolre's current official documentation still lists no refund/reversal endpoint anywhere in its Payments API — `MoolreRefundExecutor` remains fail-closed ("manual operation required"), unchanged. `resolutionsService.processRefund` selects the executor from the **linked Payment's own provider** (`getRefundExecutorForPaymentProvider`), never from today's globally-active default — a customer may have paid weeks ago via a provider CrownSourceGlobal has since stopped routing new payments to. No M9 refund *decision* logic changed. One real gap found and fixed while wiring this: `Refund.paymentId` existed since M9 but was never populated anywhere — `approveResolution()` now links the Order's successful Payment at approval time.

## Y. Card Payment (Visa/Mastercard) *(added M10B — Paystack-hosted Checkout)*

```
Customer picks "Card" at checkout — no card number, CVV, PIN, or OTP is
ever collected by CrownSourceGlobal; amount/currency/email are ALWAYS
server-derived, exactly like Mobile Money
  → paymentsService.initiateCardPayment:
      - Card is always Paystack, regardless of PAYMENT_PROVIDER (Moolre
        never supported cards) — gated only on PAYSTACK_SECRET_KEY
        actually being configured
      - same Payment row / same payment_one_active_per_order guard as
        Mobile Money (method=CARD, network=null) — a customer cannot
        have an active Mobile Money attempt and an active Card attempt
        on the same Order at once
      - calls initiatePaystackCardPayment (POST /transaction/initialize,
        channels=["card"]) — deliberately NOT the shared
        PaymentProvider.initiate() interface, which is MoMo-shaped
        (network/phone/otpcode have no card equivalent)
  → REDIRECT: full-page browser redirect to Paystack's own hosted
    Checkout page (authorization_url) — PAN/CVV/PIN/OTP entry happens
    entirely on Paystack's page, never CrownSourceGlobal's
  → customer returns to /checkout/[orderId]/payment/callback —
    NEVER treated as proof of anything; the query-string reference is
    used only as a lookup key, and the page always independently
    re-verifies via the SAME provider.verify()/applyVerifyOutcome
    funnel Mobile Money uses before ever confirming the Order
  → everything downstream of initiation is fully shared with Mobile
    Money, unchanged: the same webhook route (Paystack sends
    charge.success for cards too), the same applyVerifyOutcome funnel,
    the same amount/currency mismatch quarantine, the same guarded
    SUCCEEDED updateMany, the same PaystackRefundExecutor (refunds key
    off the Payment's own reference, never its method) — no
    CardPayment table, no CardRefundExecutor
  → on SUCCEEDED verification, Paystack's `authorization` object
    supplies safe-to-display brand/last4 only (Payment.cardBrand/
    cardLast4) — never the PAN/CVV/PIN/OTP, which Paystack never sends
    CrownSourceGlobal in the first place
```

International cards: a live Paystack account capability (accepting non-Ghana-issued cards), not a separate architecture — the same `initiateCardPayment`/hosted-Checkout flow handles it, gated entirely on the merchant account's own live configuration, never a CrownSourceGlobal code branch.
