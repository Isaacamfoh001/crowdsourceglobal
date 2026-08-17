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

## Quotation *(implemented M5)*

**Quotation** — id `PK`, reference `UQ` (customer-facing, `QT-YYYYMMDD-XXXXX`, same collision-safe convention as `Order.orderNumber`), customerProfileId `FK→CustomerProfile IDX`, origin (`INSTANT` only in M5 — `CUSTOM` is added when Custom Sourcing needs it, not guessed ahead of that work), status (`ISSUED|ACCEPTED|EXPIRED` `IDX` — `WITHDRAWN`/`SUPERSEDED` are reserved for a later milestone's manual reissue/custom-sourcing flow, not modeled yet since nothing in M5 produces them), currency, subtotal, total, issuedAt, expiresAt, acceptedAt (nullable). An issued Quotation is immutable — its `QuotationItem`s are never recomputed after creation, regardless of later catalogue/pricing changes (see workflows.md Workflow Q). Unlike Cart, a Quotation is a locked commercial offer, not mutable shopping intent — see CLAUDE.md §3's "do not simply rename Cart to Quote."

**QuotationItem** — id `PK`, quotationId `FK→Quotation IDX`, listingId `FK→VendorListing` (nullable, same rule as OrderItem — a future Custom Sourcing-origin line with no single vendor exposed to the customer needs no schema change), vendorId `FK→Vendor` (nullable, same rule), description, quantity, unitPrice, vendorPayableBasis (private — never on the customer-facing DTO), lineTotal. Snapshotted once at issuance from live `VendorListing`/`BulkPriceTier`/`VendorCostRule`, then read-only — mirrors OrderItem's snapshot philosophy exactly.

**Order** gains `originQuotationId` *(added M5)*: `FK→Quotation`, nullable, **`UQ`**. The uniqueness constraint is the entire "at most one Order per Quotation, ever" idempotency guarantee — a double-accept (double-click, retry, concurrent tab) cannot produce a second Order even under a true race, without a separate IdempotencyKey scope (see modules/orders/service.ts `createOrderFromQuotation`).

There is deliberately no persisted `DRAFT` Quotation row. The pre-issuance "Quote Builder" state lives in an HttpOnly cookie (`lib/actions/quotation.ts`) holding only `{listingId, quantity}` pairs — nothing commercial exists until "Generate Quote" re-validates every line fresh and writes an already-`ISSUED` Quotation in one transaction.

## Custom Sourcing *(implemented M6)*

The third purchasing path (see workflows.md's "Purchasing Paths" summary and Workflow R): a requirement CrownSourceGlobal cannot price deterministically from existing catalogue/pricing data, unlike M5's Instant Quotation. Customer-facing throughout; `SourcingOption`/`SourcingAllocation` are strictly internal CrownSource operational records with no representation on any customer DTO (`modules/sourcing/types.ts` deliberately has no customer-facing type that includes them, mirroring the same trust-boundary pattern already used for `VendorCostRule` and `QuotationItem.vendorPayableBasis`).

**CustomSourcingRequest** — id `PK`, requestNumber `UQ` (`SR-YYYYMMDD-XXXXX`, same collision-safe convention as Order/Quotation references), customerProfileId `FK→CustomerProfile IDX`, categoryId `FK→Category` (nullable — a request never requires an existing category), title, description, quantity (int — **M6 supports exactly one requirement per request**, not a multi-line RFQ; a customer with two distinct needs submits two requests), quantityUnit (nullable), specifications (JSON, flexible key/value — deliberately not hard-coded per-category columns), requiredByDate/deliveryCountry/deliveryRegion/deliveryCity/budgetAmount/budgetCurrency (all customer-supplied, budget is guidance only — never a hard cap on the eventual commercial offer), status, assignedStaffId `FK→AdminUser` (nullable), unableToSourceReason (customer-safe text only), submittedAt/quotedAt/closedAt. No persisted DRAFT row — submission is atomic, same reasoning as M5's Quotation.

**SourcingRequestAttachment** — id `PK`, sourcingRequestId `FK IDX`, storageKey (randomized, opaque — see `lib/storage.ts`), filename (sanitized, display-only, never used to build a storage path), mimeType, sizeBytes, uploadedByUserId, createdAt. Bytes live behind the `StorageProvider` abstraction, never in Postgres.

**SourcingOption** *(internal, staff-only)* — id `PK`, sourcingRequestId `FK IDX`, sourceType (`VENDOR_LISTING | VENDOR | EXTERNAL_SUPPLIER`), vendorId `FK→Vendor` (nullable), vendorListingId `FK→VendorListing` (nullable), externalSupplierName/externalSupplierContact (private, off-platform supplier — never a fake Vendor account), quantityAvailable, proposedQuantity, unitSupplyCost, currency, leadTimeDays, originCountry, notes (staff-only). A candidate supply source CrownSource operations is considering — never exposed to the customer, never a public bidding mechanism.

**SourcingAllocation** — id `PK`, sourcingRequestId `FK IDX`, sourcingOptionId `FK IDX`, allocatedQuantity, unitSupplyCostSnapshot/currency/leadTimeDaysSnapshot/originCountrySnapshot (all snapshotted at allocation time — the same "never derive historical economics from mutable current data" rule as OrderItem/FulfilmentItem). The sum of a request's allocations must equal its quantity before a quote can be issued (enforced in `modules/sourcing/service.ts`, not at allocation-save time — staff may save partial allocations while still planning).

**SourcingRequestActivity** — id `PK`, sourcingRequestId `FK IDX`, type (free-text event key: submitted/assigned/review_started/sourcing_started/clarification_requested/option_added/allocation_selected/quote_issued/quote_superseded/quote_accepted/unable_to_source/cancelled), actorUserId (nullable), metadata (JSON), createdAt. Staff-only — never rendered on any customer view (the customer-facing progress view is derived from `status` + timestamps instead), so an internal note can never leak through an activity feed. Lightweight history, not event sourcing.

**Quotation** gains two fields *(added M6)*: `sourcingRequestId` (nullable `FK→CustomSourcingRequest IDX` — populated only for `origin = CUSTOM_SOURCING`) and `supersedesQuotationId` (nullable, `UQ`, self-referencing `FK→Quotation` — the reissue trail: issuing a revised custom quote sets the old quote's `status = SUPERSEDED` and points the new quote's `supersedesQuotationId` at it, in one transaction, so both remain permanently queryable). `QuotationItem.listingId` stays null for every `CUSTOM_SOURCING` line (never VendorListing-backed, even when the whole allocation happens to trace to one marketplace Vendor); `QuotationItem.vendorId` is populated internally only in that single-vendor case — purely to let `Order`/`Fulfilment` creation work automatically (see Workflow R) — and is masked back to `null` on every customer-facing DTO regardless (`modules/quotation/service.ts`), so the customer never sees supplier identity for a managed-sourcing line.

**Conversation** gains a `SOURCING_REQUEST` context *(added M6)*: `contextSourcingRequestId` (nullable `FK→CustomSourcingRequest`), reusing the exact M3 Customer↔CrownSource conversation shape — no new messaging architecture. Unlike every other contextual conversation, a sourcing-request thread may legitimately be staff-initiated (a clarification request before the customer has ever written in), handled by `messagingService.staffStartOrContinueContextual`, which shares the same open-conversation dedup as the customer-initiated path.

**Production storage dependency:** `lib/storage.ts` defines a `StorageProvider` interface; the only implementation today is a local-disk development adapter (files live outside the git-tracked tree, under the OS user's home directory by default). No S3/R2/Cloudinary/etc. provider has been selected — see `docs/architecture/overview.md`'s Technology Stack table, which already lists this as an open decision. Swapping in a production provider requires implementing the same three-method interface; nothing in `modules/sourcing` or the attachment route handler needs to change.

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

## Notifications *(implemented M7)*

**Notification** — id `PK`, recipientUserId `FK→User IDX, onDelete Cascade`, type (`NotificationType`, 24-value enum spanning vendor applications, listings, orders/fulfilment/delivery, quotations, custom sourcing, messaging, and admin-facing events), title, body, targetUrl (app-relative, built only from `modules/notifications/links.ts` — never client-supplied or Host-header-derived), eventKey (dedup key, scoped per-recipient), readAt (nullable), createdAt. `@@unique([recipientUserId, eventKey])` — the entire dedup/idempotency guarantee for "one business event → one notification per recipient," even under retried callbacks or double-clicks. `@@index([recipientUserId, createdAt])` and `@@index([recipientUserId, readAt])` back the notification list and unread-count queries respectively. No raw HTML is stored — `title`/`body` are structured plain text; email rendering is a separate concern (see below). No separate role-scoped recipient table: `recipientUserId` is Better Auth's `User.id` directly, which is what gives a multi-role User (Customer + Vendor + Admin) one deduplicated stream.

**EmailDeliveryJob** — id `PK`, notificationId `FK→Notification UQ, onDelete Cascade` (nullable — a job always maps to at most one Notification, 1:1), to, subject, templateKey, templateData (JSON), status (`PENDING|SENDING|SENT|FAILED`), attempts (int, default 0), maxAttempts (int, default 5), availableAt (default now — the backoff eligibility gate), lastError (nullable), sentAt (nullable), createdAt, updatedAt. `@@index([status, availableAt])` backs the worker's candidate-batch claim query. Deliberately a dedicated table, not a generic `BackgroundJob` — email is the only async job type in the system today (see `/docs/architecture/overview.md`'s "Notifications & Email Delivery" section for the full reasoning and the generalization path if a second job type emerges).

**NotificationPreference** — id `PK`, userId `FK→User UQ, onDelete Cascade`, ordersDeliveryEmail (boolean, default true), quotationsSourcingEmail (boolean, default true), messagesEmail (boolean, default true), createdAt, updatedAt. Three togglable categories only — not an enterprise per-event-type matrix. `modules/notifications/policy.ts`'s static map decides which `NotificationType`s are gated by which category, and which are `required: true` (never gated at all — moderation outcomes, commerce-critical confirmations, and admin-facing events). In-app notifications are never gated by this table; it only ever governs the email channel.

## Operational / Cross-Cutting

**InventoryReservation** — id `PK`, listingId `FK→VendorListing IDX`, orderId `FK→Order` (nullable while cart-held), quantity, status (`held|released|committed`), expiresAt `IDX`. Reservation is created atomically with the `PENDING_PAYMENT` Order; a background sweep releases expired holds.

**IdempotencyKey** — id `PK`, key `UQ`, scope (`checkout|webhook|payout_claim`), resultRef, createdAt.

**BackgroundJob** — planned generic shape for future async job types; not yet implemented. M7 built `EmailDeliveryJob` (above) as a dedicated table for the one async job type that exists today rather than generalizing ahead of a second use case — see `/docs/architecture/overview.md`.

**AuditEvent** — id `PK`, actorUserId `FK→User` (nullable for system), action, targetType, targetId, metadata (JSON), createdAt `IDX`.

## Admin Operations Dashboard *(implemented M8 — no new persisted entities)*

Deliberately introduces **no new database table**. The M8 admin dashboard's "attention items" (`modules/admin-dashboard/types.ts`'s `AttentionItem`) are computed at read time from fields that already exist on `VendorApplication`, `VendorListing`, `CustomSourcingRequest`, `Fulfilment`/`FulfilmentIssue`/`Shipment`, `Conversation`/`Message`, and `Quotation` — never stored anywhere themselves. If a future reader is looking for an `AttentionItem` or similar table in this document and doesn't find one, that's correct, not an omission — see `/docs/architecture/overview.md`'s "Admin Operations Dashboard" section for the full reasoning. Five indexes were added to support the new query shapes this derivation requires: `VendorApplication(status, submittedAt)`, `VendorListing(approvalStatus, submittedAt)`, `Fulfilment(status, updatedAt)`, `Quotation(status, expiresAt)`, `Order(status, createdAt)`.

## Invariant Enforcement Summary

- **Historical pricing:** `OrderItem`/`FulfilmentItem` store values directly; they never foreign-key into live `Pricing`/`VendorCostRule`.
- **Oversell prevention:** `InventoryReservation` created inside the same DB transaction as the `PENDING_PAYMENT` Order.
- **Duplicate webhooks/claims:** `UQ` constraints on `Payment.providerEventId` and `PayoutItem.fulfilmentItemId`.
- **Quotation reuse:** implicit one-Order-per-Quotation relationship via `Order.originQuotationId`.
- **Audit coverage:** every domain service writes an `AuditEvent` inline with its own state-changing transaction.
