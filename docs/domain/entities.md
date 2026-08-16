# CrownSourceGlobal — Data Model

High-level relational data model (PostgreSQL-oriented). This is a domain preview sufficient to guide implementation, not a migration file. Notation: `PK` primary key, `FK→X` foreign key, `UQ` unique constraint, `IDX` index.

## Identity & Customers

**User** (Better Auth-owned) — id `PK`, email `UQ`, passwordHash (nullable — Google-only users may have none), emailVerifiedAt, role (`customer|vendor|admin`), status, createdAt. Better Auth additionally owns its own `Account` (linked OAuth/credential providers) and `Session` tables per its schema conventions.

**CustomerProfile** — id `PK`, userId `FK→User UQ`, organizationId `FK→Organization` (nullable), displayName, phone, businessInfo (nullable JSON: company name, tax id), createdAt.

**Organization** — id `PK`, name, type (business/institution/etc.), createdAt. V1: an optional tag on a CustomerProfile, not a multi-user account.

## Vendors

**Vendor** — id `PK`, companyName, verificationStatus, storefrontSlug `UQ`, createdAt.

**VendorMembership** — id `PK`, userId `FK→User`, vendorId `FK→Vendor`, role (owner/staff), `UQ(userId, vendorId)`.

## Catalogue & Pricing

**Category** — id `PK`, name, slug `UQ`, parentCategoryId `FK→Category` (nullable, self-referencing tree).

**VendorListing** — id `PK`, vendorId `FK→Vendor IDX`, categoryId `FK→Category IDX`, title, description, images (JSON array), specs (JSON), basePrice (decimal), currency, moq (int), maxOq (int, nullable), leadTimeDays (int, nullable), availableQuantity (int), availabilityStatus, listingStatus, approvalStatus, createdAt, updatedAt. *(The sellable unit — see ADR 0003. No canonical cross-vendor Product entity.)*

**BulkPriceTier** — id `PK`, listingId `FK→VendorListing IDX`, minQuantity (int), maxQuantity (int, nullable), unitPrice (decimal), `UQ(listingId, minQuantity)`.

**VendorCostRule** — id `PK`, listingId `FK→VendorListing UQ`, vendorSupplyCost (decimal), marginRuleType, marginValue (decimal). Kept separate from `VendorListing` so vendor-cost/margin access control can differ from public listing data access.

## Cart

**Cart** — id `PK`, customerProfileId `FK→CustomerProfile IDX`, status (active/converted), createdAt.

**CartItem** — id `PK`, cartId `FK→Cart IDX`, listingId `FK→VendorListing`, quantity (int), addedAt. No price stored — always resolved live against current Pricing.

## Custom Sourcing & Quotation

**CustomSourcingRequest** — id `PK`, customerProfileId `FK→CustomerProfile IDX`, title, description, categoryId `FK→Category` (nullable), quantity, specifications (JSON), desiredDeliveryDate, deliveryLocation, attachments (JSON array of file refs), status, createdAt.

**SourcingAllocation** — id `PK`, customSourcingRequestId `FK→CustomSourcingRequest IDX`, vendorId `FK→Vendor`, quantity (int), unitCost (decimal), notes. Records CrownSourceGlobal's internal vendor split for a custom sourcing request.

**Quotation** — id `PK`, reference `UQ`, customerProfileId `FK→CustomerProfile IDX`, origin (`instant|custom`), customSourcingRequestId `FK→CustomSourcingRequest` (nullable), status, currency, subtotal, tax, fees, total, validUntil, createdAt.

**QuotationItem** — id `PK`, quotationId `FK→Quotation IDX`, listingId `FK→VendorListing` (nullable for custom), vendorId `FK→Vendor` (**nullable** — null for internally-allocated custom-sourcing lines), description, quantity, unitPrice, vendorPayableBasis, lineTotal.

## Orders & Fulfilment

**Order** — id `PK`, orderNumber `UQ`, customerProfileId `FK→CustomerProfile IDX`, originType (`cart|quotation`), originQuotationId `FK→Quotation` (nullable), status, paymentStatus (tracked separately from `status` — see state machines), currency, subtotal, tax, fees, total, deliveryInfo (JSON), createdAt.

**OrderItem** — id `PK`, orderId `FK→Order IDX`, listingId `FK→VendorListing` (nullable for custom), vendorId `FK→Vendor` (**nullable**, same rule as QuotationItem), description, quantity, unitPrice, vendorPayableBasis, lineTotal. *This is the first point standard-path pricing becomes authoritative — see `/docs/workflows/workflows.md`.*

**Fulfilment** — id `PK`, orderId `FK→Order IDX`, vendorId `FK→Vendor IDX`, status, createdAt. No uniqueness constraint on `(orderId, vendorId)` — multiple Fulfilments per vendor per Order are legal (supports future partial/split fulfilment).

**FulfilmentItem** — id `PK`, fulfilmentId `FK→Fulfilment IDX`, orderItemId `FK→OrderItem IDX`, quantity (int, a portion of the OrderItem's quantity), unitPrice (copied from OrderItem), vendorPayableBasis (copied from OrderItem), payoutEligibility, payoutHold (boolean), payoutHoldReason (nullable).

**Shipment** *(implemented M4 — supersedes the earlier placeholder shape)* — id `PK`, fulfilmentId `FK→Fulfilment IDX` (deliberately **not unique** — the M4 normal path is one Shipment per Fulfilment, but leaving this unconstrained means a future partial-shipment split needs no schema change; true consolidation, several Fulfilments sharing one Shipment, would still need a join table later), status (`CREATED|COLLECTED|IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED|DELIVERY_FAILED|EXCEPTION`), carrier (nullable), trackingReference (nullable). Domestic collection fields: collectionScheduledAt, collectionNotes, collectedAt, collectedByUserId. International inbound fields: receivingLocationId `FK→ReceivingLocation` (nullable), shippedAt/expectedArrivalAt (vendor-entered), receivedAt/receivedByUserId (CrownSource-confirmed only). Onward delivery fields: outForDeliveryAt, deliveredAt, deliveryFailedAt, deliveryNotes. `customerConfirmedReceiptAt` is an additional signal only, never the sole authoritative delivery confirmation. `status` semantics: the vendor→CrownSource handoff (domestic pickup or international transit) is tracked entirely via `Fulfilment.status` reaching `DISPATCHED` plus the plain informational fields above — `Shipment.status` itself only begins progressing at `COLLECTED` ("CrownSource now holds this physically," regardless of whether that came from a domestic pickup or an international receipt), avoiding an ambiguous double meaning of `IN_TRANSIT` for two different legs.

**FulfilmentIssue** *(added M4)* — id `PK`, fulfilmentId `FK→Fulfilment IDX`, status (`OPEN|RESOLVED`), category, description, reportedByUserId, createdAt, resolvedAt/resolvedByUserId/resolutionNotes (nullable until resolved). The M4 "operational exception boundary" — a vendor-reportable problem that pauses a Fulfilment (`status` → `EXCEPTION`) for CrownSource operations to resolve. Deliberately does not touch OrderItem, payment amounts, or quantities — a full refund/replacement/quantity-adjustment platform is out of scope.

**ReceivingLocation** *(added M4)* — id `PK`, name, type (nullable free text: office/warehouse/consolidation/freight_forwarder/...), active (boolean), country, region/city (nullable), addressLine1, contactName/contactPhone (nullable, private). A CrownSource-controlled physical receiving point for international inbound Fulfilments — never assume there is exactly one. Admin-only; never on any public DTO. New international Fulfilments are assigned the oldest active location by default at creation time; operations may reassign per-Fulfilment.

**Fulfilment** gains an `origin` field *(added M4)*: `DOMESTIC_COLLECTION | INTERNATIONAL_INBOUND`, decided once at Fulfilment-creation time from the vendor's country at that moment (never re-derived later — same snapshot philosophy as OrderItem/FulfilmentItem pricing) and a `submittedAt`-equivalent distinction is not needed here since Fulfilment's own approval concept doesn't apply; instead note that `Fulfilment.status = PENDING` is unambiguous (no draft/submitted overload, unlike VendorListing).

**Vendor** gains private pickup/collection fields *(added M4)*: pickupAddressLine1, pickupContactName, pickupContactPhone, pickupHours, pickupNotes — deliberately separate from the general country/region/city (which describe where the store operates commercially); these are the precise details CrownSource-arranged collection actually uses. Never on the public storefront DTO.

## Payments & Payouts

**Payment** — id `PK`, orderId `FK→Order IDX`, providerEventId `UQ` (nullable until confirmed), provider, method (`momo|card|...`), amount, currency, status, initiatedAt, confirmedAt.

**Refund** — id `PK`, paymentId `FK→Payment IDX`, orderItemId `FK→OrderItem` (nullable — full vs. partial), amount, reason, status, requestedAt, completedAt.

**PayoutRun** — id `PK`, vendorId `FK→Vendor IDX`, status, totalAmount, createdAt, paidAt.

**PayoutItem** — id `PK`, payoutRunId `FK→PayoutRun IDX`, fulfilmentItemId `FK→FulfilmentItem UQ` (one claim per item, ever), amount.

**PayoutAdjustment** — id `PK`, vendorId `FK→Vendor IDX`, fulfilmentItemId `FK→FulfilmentItem` (nullable), amount (signed), reason, createdAt, appliedToPayoutRunId `FK→PayoutRun` (nullable until netted). The mechanism for post-hoc payout corrections — see ADR 0005.

## Documents, Messaging, Notifications

**Document** — id `PK`, type (`quotation|invoice|receipt|payout_statement`), sourceType/sourceId (polymorphic reference to Quotation/Order/Payment/PayoutRun), structuredSnapshot (JSON), generatedFileRef (nullable, storage key), generatedAt.

**Conversation** — id `PK`, participantType (`customer|vendor`), participantId, context (`product|order|quotation|custom_request|storefront|general`), contextId (nullable), status, createdAt.

**Message** — id `PK`, conversationId `FK→Conversation IDX`, senderUserId `FK→User`, body, createdAt.

**Notification** — id `PK`, userId `FK→User IDX`, eventType, payload (JSON), channel, deliveryStatus, readAt (nullable), createdAt.

## Operational / Cross-Cutting

**InventoryReservation** — id `PK`, listingId `FK→VendorListing IDX`, orderId `FK→Order` (nullable while cart-held), quantity, status (`held|released|committed`), expiresAt `IDX`. Reservation is created atomically with the `PENDING_PAYMENT` Order; a background sweep releases expired holds.

**IdempotencyKey** — id `PK`, key `UQ`, scope (`checkout|webhook|payout_claim`), resultRef, createdAt.

**BackgroundJob** — id `PK`, type, payload (JSON), status (`pending|processing|done|failed`), attempts, runAfter, createdAt.

**AuditEvent** — id `PK`, actorUserId `FK→User` (nullable for system), action, targetType, targetId, metadata (JSON), createdAt `IDX`.

## Invariant Enforcement Summary

- **Historical pricing:** `OrderItem`/`FulfilmentItem` store values directly; they never foreign-key into live `Pricing`/`VendorCostRule`.
- **Oversell prevention:** `InventoryReservation` created inside the same DB transaction as the `PENDING_PAYMENT` Order.
- **Duplicate webhooks/claims:** `UQ` constraints on `Payment.providerEventId` and `PayoutItem.fulfilmentItemId`.
- **Quotation reuse:** implicit one-Order-per-Quotation relationship via `Order.originQuotationId`.
- **Audit coverage:** every domain service writes an `AuditEvent` inline with its own state-changing transaction.
