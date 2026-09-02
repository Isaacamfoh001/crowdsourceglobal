# CrownSourceGlobal Mobile V1 Product & Architecture Plan

**Document status:** Planning baseline\
**Version:** 1.0\
**Date:** 26 August 2026\
**Scope:** CrownSourceGlobal native mobile application (Customer +
Vendor), shared backend, web-only Admin\
**Primary mobile stack:** React Native + Expo + TypeScript\
**Existing platform:** Next.js + TypeScript + PostgreSQL/Prisma + Better
Auth + Paystack + Cloudflare R2 + Railway/production infrastructure

---

## 1. Purpose of This Document

This is the single planning document for CrownSourceGlobal Mobile V1. It
is intended to prevent the mobile project from becoming an unstructured
rewrite of the existing web application.

The mobile application will be a new client for the existing
CrownSourceGlobal platform, not a separate product with duplicated
backend logic.

This document defines:

- Mobile V1 product scope.
- Customer and Vendor experiences.
- What remains web-only.
- Shared backend architecture.
- API strategy.
- Authentication and onboarding.
- Explore and Saved functionality.
- Commerce, sourcing, quotation, order and fulfilment flows.
- Vendor operations.
- Payments.
- Notifications and deep linking.
- Media and storage.
- Security and privacy.
- Mobile environments and release strategy.
- App Store and Google Play requirements.
- Testing and production-readiness gates.
- Milestone sequence.
- Explicitly deferred features.
- Architectural decisions that should not be casually revisited during
  implementation.

---

# 2. Product Vision

CrownSourceGlobal Mobile should not be a WebView wrapper or a
screen-for-screen recreation of the web application.

The mobile product should provide a native, visual, fast experience
centered on:

> **Discover beauty → Explore products and vendors → Shop → Source
> anything → Manage orders/business.**

The application will support both Customers and Vendors within one
installed app.

The existing web application remains important:

- Customers can continue using the web/PWA.
- Vendors can continue using the Vendor Portal.
- Admin operations remain web-first.
- Mobile and web operate on the same backend and database.

The native app therefore expands CrownSourceGlobal rather than replacing
the web application.

---

# 3. Core Architecture Decision

## 3.1 One Platform, Multiple Clients

The target architecture is:

```text
                         CrownSourceGlobal Platform

                    PostgreSQL / Cloudflare R2
                    Paystack / SMS Provider
                              |
                              v
                  Shared CrownSource Backend
             Domain services + auth + API layer
                     /                 \
                    /                   \
          Existing Next.js Web       Mobile API
                 |                       |
       Customer / Vendor / Admin     React Native
                                      /       \
                                Customer     Vendor
```

There will be:

- one production database;
- one authoritative User identity;
- one Vendor/store record;
- one catalogue;
- one inventory system;
- one cart/order model;
- one sourcing/quotation workflow;
- one payment system;
- one notification domain;
- one finance/settlement system.

The mobile application must not introduce parallel versions of these
domains.

---

## 3.2 The API Is a Doorway, Not a Second Backend

The existing Next.js application can call server-side services directly.

Example:

```text
Web page/server action
        ↓
cartService.addItem()
        ↓
Prisma
        ↓
PostgreSQL
```

A native mobile application cannot directly execute CrownSourceGlobal's
server-side modules on the customer's phone. It therefore communicates
over HTTPS:

```text
Mobile app
        ↓
POST /api/cart/items
        ↓
API handler
        ↓
cartService.addItem()
        ↓
Prisma
        ↓
PostgreSQL
```

The important rule is:

> **API handlers must call existing domain/application services wherever
> possible.**

Do not create:

```text
webCartService
mobileCartService
```

Do:

```text
cartService
    ↑
 Web API / Server Action
    ↑
 Mobile API
```

This prevents web/mobile differences in:

- prices;
- MOQ rules;
- inventory;
- reservations;
- approval rules;
- quotation calculations;
- fulfilment;
- refunds;
- resolutions;
- payouts.

---

# 4. Application Strategy

## 4.1 One Mobile App for Customer and Vendor

CrownSourceGlobal should initially publish **one mobile application**,
not separate Customer and Vendor apps.

Reasons:

- A Vendor may also be a Customer.
- A Customer may later become a Vendor.
- Authentication and notifications remain simpler.
- Only one App Store/Play Store product needs to be maintained.
- CrownSourceGlobal maintains one mobile brand.
- Less duplicated engineering and release work.

Admin remains web-only for V1.

---

## 4.2 Account Capabilities, Not Permanent Roles

Do not permanently classify a person as only CUSTOMER or only VENDOR
during sign-up.

A user can have:

```text
User
 ├── Customer capabilities
 └── Vendor membership/store (optional)
```

A normal Customer can later choose **Start selling**.

A Vendor can still:

- browse;
- save products;
- source;
- purchase;
- maintain personal orders.

---

# 5. Mobile V1 Scope

Mobile V1 means a production-quality first native release, not every
feature that exists or may eventually exist in CrownSourceGlobal.

## 5.1 Included --- Shared

- Native iOS and Android application.
- Authentication/session persistence.
- Phone OTP once SMS provider access is available.
- Google sign-in where supported/configured.
- Existing email/password path if retained.
- Initial use-intent onboarding.
- Customer/Vendor mode awareness.
- Notifications center.
- Deep links for important entities.
- Image upload/photo library integration.
- Shared CrownSourceGlobal visual identity.
- Production API integration.
- Error/loading/empty states.
- Secure local session storage.

## 5.2 Included --- Customer

- Home.
- Explore.
- Shop/catalogue.
- Search and categories.
- Product details.
- Vendor storefronts.
- Saved products.
- Cart.
- Checkout.
- Paystack payment flow.
- Orders.
- Order detail/tracking.
- Sourcing requests.
- Sourcing request status.
- Quotations.
- Quotation acceptance/checkout.
- Quotation PDF access where applicable.
- Messages where existing backend supports them cleanly.
- Resolutions/refund visibility.
- Account/profile.
- Notification preferences where appropriate.

## 5.3 Included --- Vendor

- Vendor onboarding.
- Application status.
- Business mode after approval.
- Business Home.
- Listings.
- Create/edit listing.
- Product image upload.
- Listing moderation status.
- Orders.
- Fulfilment actions.
- Resolutions relevant to Vendor.
- Finance/earnings.
- Settlements.
- Payout destination management where supported.
- Messages.
- Vendor notifications.
- Store settings/basic profile.

## 5.4 Admin

No native Admin application in V1.

Admin continues using the responsive production web application.

The Admin web application and mobile clients share the same
backend/database, so:

- Vendor mobile submission appears in Admin web.
- Admin approval becomes visible to Vendor mobile.
- Admin quotation becomes visible to Customer mobile.
- Admin fulfilment/resolution actions affect the same records used by
  mobile.
- No manual synchronization is required.

---

# 6. Mobile Navigation

## 6.1 Customer Mode

Recommended primary bottom navigation:

```text
Home | Explore | Shop | Source | Account
```

### Home

Purpose: entry point and platform overview.

Initial sections may include:

- promotional/brand hero;
- categories;
- new/featured products;
- Explore preview;
- featured Vendors;
- Source Anything CTA;
- recent activity/order shortcut for signed-in users.

Avoid fake personalization in V1.

### Explore

Visual discovery experience.

Primary content initially comes from approved CrownSourceGlobal
marketplace content.

Potential card types:

- product;
- Vendor/store;
- curated beauty content;
- new arrivals.

Future types may include services and creator/provider content.

### Shop

Commerce-focused browsing:

- categories;
- search;
- filters;
- listing grid;
- listing details;
- Vendor storefront.

### Source

Direct entry into CrownSourceGlobal's custom sourcing proposition:

- description;
- photos;
- quantity;
- destination;
- specifications;
- submit;
- track.

### Account

- profile;
- orders;
- sourcing;
- quotations;
- saved;
- messages;
- notifications;
- resolutions;
- settings;
- Start Selling / Switch to Business where applicable.

---

# 7. Vendor / Business Mode

An approved Vendor should have a distinct Business experience without
requiring another login.

Recommended navigation:

```text
Home | Orders | Listings | Finance | More
```

## 7.1 Business Home

Prioritize operational action, not vanity metrics.

Suggested hierarchy:

1.  Needs your attention.
2.  New/pending orders.
3.  Listings requiring action.
4.  Fulfilment status.
5.  Finance snapshot.
6.  Messages/recent activity.

## 7.2 Orders

Vendor can:

- view orders relevant to their fulfilments;
- open order detail;
- perform only allowed sequential fulfilment actions;
- see delivery/fulfilment status;
- see relevant resolution information.

The existing backend state machine remains authoritative.

## 7.3 Listings

Vendor can:

- create a listing;
- photograph/select product images;
- set title;
- description;
- category;
- price;
- inventory/availability fields already supported;
- edit;
- submit for review;
- see moderation status;
- respond to requested changes.

The mobile client must not bypass Admin approval.

## 7.4 Finance

Expose existing finance domain safely:

- earnings;
- adjustments where relevant;
- settlements;
- payout status;
- payout destination.

Do not calculate Vendor balances independently on the device.

## 7.5 More

May contain:

- Store settings.
- Messages.
- Resolutions.
- Notifications.
- Account.
- Switch to Shopping.
- Sign out.

---

# 8. Mode Switching

Users with Vendor capability should be able to switch between:

```text
Shopping
Business
```

Requirements:

- No second authentication.
- No second account.
- Last selected mode may be remembered locally.
- Customer-only users do not see unnecessary Business UI.
- Pending Vendor applicants see application status, not an operational
  Vendor dashboard.
- Rejected/closed applications follow existing backend rules.
- Admin approval unlocks Business capability based on server truth.

Mode selection is a presentation/navigation concept. Authorization must
always be enforced by the backend.

---

# 9. Authentication and Onboarding

## 9.1 Authentication Principle

Maintain **one CrownSourceGlobal identity system**.

Existing identity is based on Better Auth. Do not casually introduce
Firebase Authentication as a second identity authority solely for phone
OTP.

Desired authentication methods:

- Phone OTP --- intended primary mobile-friendly method.
- Google.
- Email/password where existing product requirements retain it.

All methods should resolve to the same CrownSourceGlobal User identity.

## 9.2 Phone OTP

Current decision:

- Better Auth owns phone authentication/verification/session
  semantics.
- External SMS provider delivers OTP messages.
- Hubtel is the preferred Ghana-oriented provider, subject to
  account/API approval.
- Hubtel developer API-key approval is currently pending/requires
  follow-up by phone.
- Do not block broader mobile planning on Hubtel approval.

Desired settings:

- E.164 normalized phone numbers.
- Ghana +233 as initial/default UX.
- 6-digit OTP.
- Approximately 5-minute expiry.
- Limited verification attempts.
- Resend cooldown.
- Per-phone and per-IP abuse controls.
- No OTP logging in production.
- SMS spend abuse protection.

If Hubtel remains unavailable, evaluate another transactional SMS
provider without changing the underlying CrownSource authentication
domain.

## 9.3 Firebase Decision

Firebase Phone Authentication is not the current preferred solution
because it would introduce another authentication authority alongside
Better Auth.

Do not use Firebase merely as an SMS transport unless the chosen
integration cleanly preserves Better Auth as the identity/session
authority.

Revisit only if there is a concrete integration or operational reason.

## 9.4 First-Time Onboarding

Do not ask:

> Are you a Customer or Vendor?

Prefer:

> **How would you like to use CrownSource?**

Options:

### Shop & Source

Discover, buy and source products.

### Sell

Create a store and sell through CrownSourceGlobal.

### Both

Shop and operate a store.

This answer determines the initial experience; it must not permanently
restrict the account.

## 9.5 Vendor Onboarding

For Sell/Both:

```text
Authentication
      ↓
Use-intent selection
      ↓
Vendor onboarding
      ↓
Application submitted
      ↓
Customer functionality remains available
      ↓
Admin reviews on web
      ↓
Approved
      ↓
Business mode unlocked
```

Reuse the existing VendorApplication/Vendor domain and approval
semantics.

---

# 10. Mobile API Architecture

## 10.1 Principles

Every mobile endpoint should:

1.  Authenticate the caller.
2.  Validate input.
3.  Authorize the requested operation.
4.  Call the existing domain/application service.
5.  Return a stable mobile-safe response.
6.  Avoid exposing internal/sensitive fields.
7.  Preserve existing transactional behavior.

Do not put business rules into React Native.

## 10.2 API Versioning

Prefer a stable namespace, for example:

```text
/api/mobile/v1/...
```

or a general versioned API:

```text
/api/v1/...
```

Final choice should follow an audit of existing API routes.

The important requirement is a clear compatibility boundary so future
web changes do not accidentally break shipped mobile versions.

## 10.3 Initial API Inventory

### Identity / Session

```text
GET  /api/v1/me
POST / auth endpoints as supported by Better Auth
```

### Home

```text
GET /api/v1/mobile/home
```

This can aggregate lightweight home-screen data to avoid many network
round trips.

### Catalogue

```text
GET /api/v1/categories
GET /api/v1/listings
GET /api/v1/listings/:id
GET /api/v1/vendors/:slug
```

### Explore

```text
GET /api/v1/explore
```

### Saved

```text
GET    /api/v1/saved
POST   /api/v1/saved/:listingId
DELETE /api/v1/saved/:listingId
```

### Cart

```text
GET    /api/v1/cart
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:id
DELETE /api/v1/cart/items/:id
```

### Checkout / Payment

Expose only server-authoritative operations required by the chosen
Paystack mobile flow.

### Orders

```text
GET /api/v1/orders
GET /api/v1/orders/:id
```

### Sourcing

```text
POST /api/v1/sourcing
GET  /api/v1/sourcing
GET  /api/v1/sourcing/:id
```

### Quotations

```text
GET /api/v1/quotations
GET /api/v1/quotations/:id
GET /api/v1/quotations/:id/pdf
```

### Vendor

API endpoints should expose existing Vendor operations rather than
recreate them:

- application/onboarding;
- store;
- listings;
- orders/fulfilments;
- finance;
- settlements;
- resolutions;
- messages.

Exact routes should be defined after auditing existing service/action
boundaries.

---

# 11. API Response Design

Mobile clients may remain installed for months while the backend
continues changing.

Therefore:

- Return explicit DTOs/view models.
- Do not serialize arbitrary Prisma models directly.
- Avoid exposing internal cost/margin fields.
- Avoid relying on database enum details that are not intended as
  client contracts.
- Use stable IDs.
- Return ISO date/time strings.
- Return money as explicit currency + amount representation.
- Paginate collections.
- Use deterministic newest-first ordering where appropriate.
- Return machine-readable error codes plus user-safe messages.
- Maintain backward compatibility during a supported mobile release.

---

# 12. Explore V1

Explore is a major product addition and should make the mobile app feel
materially different from the existing transactional web experience.

## 12.1 V1 Goal

A visually rich discovery feed powered primarily by already-approved
marketplace content.

Do not build a social network in V1.

## 12.2 Initial Content

Possible feed items:

- approved products;
- new products;
- featured products;
- featured Vendors;
- curated beauty collections.

## 12.3 Feed Behavior

V1 may use simple deterministic ranking:

- featured/curated;
- recency;
- category diversity;
- approved/active status.

Do not claim AI personalization until real personalization exists.

## 12.4 Deferred Explore Features

- comments;
- followers;
- creator social graph;
- Reels/TikTok-style video;
- complex recommendation ML;
- public popularity leaderboard;
- direct social posting.

---

# 12A. Explore Architecture — Real Beauty Discovery (implemented M21)

M21 replaced §12's placeholder ("approved marketplace content") with a real,
backend-backed provider-portfolio system: `ExplorePost` — a beauty
professional/business's photo(s) of finished work (a hairstyle, wig
install, makeup look, nail set, lash set, barbering, skincare result),
distinct from `VendorListing` (a sellable product). This is unrelated to
the pre-existing `GET /api/v1/explore` endpoint (M18.2,
`catalogueService.listExploreSections()`), which still serves category-
grouped commerce listings and is untouched.

## 12A.1 Publisher identity

An approved `Vendor` (the same identity the web Vendor Portal already
grants access to) publishes `ExplorePost` rows — the smallest identity that
already carries a public name/logo/location and a real moderation
relationship with CrownSource. There is no dedicated beauty-professional/
service-profile domain yet; building one prematurely was explicitly out of
scope. `ExplorePost.vendorId` (not a polymorphic/`providerId` reference) is
what keeps this minimal today — a future dedicated provider-profile domain
can widen ownership (e.g. an optional `providerId` alongside `vendorId`)
without dropping or restructuring the table. Eligibility is resolved
server-side (`modules/explore-posts/policy.ts`'s
`resolveExplorePostPublisher`) from the caller's first `VendorMembership`,
requiring `Vendor.verificationStatus === "APPROVED"` — mirrors every other
public-vendor-identity read path in the backend.

## 12A.2 Data model

`ExplorePost` (caption, `images: Json` — 1-6 storage keys, `categoryId`,
`vendorId`) with a moderation state machine that deliberately mirrors
`VendorListing`'s existing two-axis model exactly, rather than inventing a
new one:

- `approvalStatus` literally reuses the `ListingApprovalStatus` enum
  (`PENDING`/`APPROVED`/`CHANGES_REQUESTED`/`REJECTED`).
- `visibility` is a smaller 3-value analogue of `ListingStatus`
  (`DRAFT`/`PUBLISHED`/`ARCHIVED` — no `INACTIVE`; M21 has no
  "temporarily hide, plan to reactivate" requirement).
- A published post's material edit is staged in `pendingChanges`
  (`{caption, categoryId, images}`), exactly like `VendorListing`'s own
  field — the live FIELD DATA is undisturbed AND (M21.1 correction) the
  post STAYS visible/public on the feed throughout re-review: the public
  feed query gates only on `visibility: PUBLISHED` (set once, at first
  approval, and only ever cleared by an explicit archive — never touched
  by a re-review submission), never on `approvalStatus`. M21's original
  implementation also required `approvalStatus = APPROVED` here, copying
  `VendorListing`'s `PUBLIC_LISTING_WHERE` — that made an already-live post
  vanish from the public feed the instant its owner submitted an edit.
  `VendorListing` has this same latent bug; it was not touched by the
  M21.1 fix (out of scope — flagged for a future correction).

`ExplorePostLike`/`ExplorePostSave` are real, idempotent, `User`-owned
(never anonymous) join tables with a `@@unique([explorePostId, userId])`
constraint as the duplicate-tap guarantee. Like/save counts are always a
live `_count` aggregate, never a stored counter column. Full detail and
rationale: `prisma/schema.prisma`'s M21 section header comment.

## 12A.3 Category strategy

Reuses the SAME `Category` table/taxonomy as commerce — not a second
category universe. Four slugs are reused as-is because they already
represent a type of beauty work (`wigs`, `makeup-cosmetics`, `lashes-brows`,
`skincare`); three are new top-level rows added only because no existing
commerce category represented that work type at all (`hairstyling`,
`nails`, `barbering`). See `prisma/reference-data.ts`'s
`EXPLORE_CATEGORY_SLUGS`/`EXPLORE_CATEGORIES`. These three new rows are
never added to `CANONICAL_TOP_LEVEL_SLUGS`, so Shop's commerce navigation
is unaffected.

## 12A.4 Location

Not snapshotted onto `ExplorePost` — `Vendor.city`/`region`/`country` are
already public fields, and duplicating them would drift the moment a
vendor updates their storefront location. The public feed DTO joins them
live (`lib/api/dto/explore-posts.ts`).

## 12A.5 Image storage

Reuses the existing M13 `StorageProvider` abstraction unchanged (local disk
in dev, Cloudflare R2 in production) — no second image-storage system.
`explore-post-images/<uuid>.<ext>` keys, served by a new public,
unauthenticated route (`app/api/explore-posts/images/[key]/route.ts`,
prefix-scoped, mirroring the existing `listings/images` route exactly).
1-6 images per post (`modules/explore-posts/image-validation.ts` — same
PNG/JPEG/WEBP + 5MB-per-file limits as listing images, kept as a
deliberately separate small file rather than a shared abstraction, matching
this codebase's existing `lib/attachment-validation.ts` vs.
`vendor-listings/image-validation.ts` precedent). Removed/replaced images
are never deleted from storage — same "opaque keys are cheap to leave
orphaned" convention `VendorListing` already established; a future storage
lifecycle/cleanup pass (if ever needed) would cover both at once.

## 12A.6 Public API

`GET /api/v1/explore-posts` — public, unauthenticated, cursor-paginated
(`createdAt desc, id desc`, opaque base64 cursor —
`modules/explore-posts/repository.ts`'s `encodeExploreFeedCursor`), an
optional `?category=<slug>` filter, PUBLISHED+APPROVED only. A signed-in
caller additionally gets real `likedByMe`/`savedByMe`; anonymous always
gets `false` for both (never an anonymous like/save record). Response
shape: `{ data: { rows: ExplorePostDTO[], nextCursor: string | null } }`.

Engagement: `POST`/`DELETE /api/v1/explore-posts/[id]/like` and
`.../save` — authenticated only (401 otherwise), idempotent both
directions, rate-limited (60/min/user via the existing
`lib/rate-limit.ts` — no new infrastructure).
`GET /api/v1/explore-posts/saved` — the caller's own saved posts, same
cursor shape.

Publishing (approved-Vendor-only): `POST /api/v1/explore-posts`
(`multipart/form-data`: caption, categoryId, 1-6 `images` file parts;
create-and-submit in one shot — mobile has no persisted "save as draft"
step) and `PATCH /api/v1/explore-posts/[id]` (edit own post — direct if
never public, staged if already PUBLISHED). `POST
/api/v1/explore-posts/[id]/archive` unpublishes (never deletes). `GET
/api/v1/explore-posts/mine` — the vendor's own posts at every status,
page-paginated. `GET /api/v1/explore-posts/categories` — the fixed Explore
category allowlist, backing the create-post picker.

## 12A.7 Admin moderation

`/admin/explore-posts` (queue, oldest-submission-first, paginated) and
`/admin/explore-posts/[id]` (detail + Approve/Request changes/Reject),
mirroring `/admin/listings` exactly — same `requireAdminSession`
`["SUPER_ADMIN", "OPS_ADMIN"]` gating, same
`components/admin/ListingImageReview.tsx` lightbox component (generalized
with a `resolveUrl`/`label` prop rather than duplicated) so admin can see
every submitted photo before deciding, per the listing-moderation
precedent this milestone was explicitly told to reuse.

## 12A.8 Vendor web capability

`/vendor/portal/explore` — read-only-plus-archive: every post the vendor
has posted, at any status, with an Archive action for a live post. Post
**creation is deliberately mobile-only** for M21 V1 — camera roll/gallery
access is already native there, and a parallel multi-image web upload form
would duplicate that exact flow for marginal V1 benefit.

## 12A.9 Mobile integration

`src/features/explore/*` — `useExploreFeed`/`useSavedExplorePosts`
(`useInfiniteQuery`, cursor-based), `useExploreEngagement`
(optimistic like/save across every cached feed/saved query, with
rollback-on-error), `useCreateExplorePost` (multipart upload via
`expo-image-picker`), `useExploreCategories`, `useMyExplorePosts`,
`eligibility.ts` (UI-affordance-only mirror of the backend's own
eligibility check — the backend independently re-verifies on every
mutating request). `src/lib/api/client.ts` was extended from GET-only to
support JSON/multipart mutations (`post`/`patch`/`delete`), since M21 is
this codebase's first mobile mutation flow.

`ExplorePostCard` gained real multi-image carousel support (paged
`FlatList` + dot indicator, replacing M19.2's single-placeholder-tile
card) while keeping the same approved visual language (4:5 imagery,
provider header, interaction row, caption). The M19 development fixtures
(`src/features/explore/devPostFixtures.ts`) were deleted; the Explore tab
now renders `GET /api/v1/explore-posts` through the standard TanStack Query
+ loading/error/empty/pull-to-refresh/pagination pattern already
established by Shop (`src/app/(tabs)/shop.tsx`).

Post creation: `/explore/create` (modal, gated on the same eligibility
check, `expo-image-picker` for 1-6 photo selection —
`photosPermission`/`cameraPermission: false`/`microphonePermission: false`
configured in `app.json`'s `expo-image-picker` plugin entry, since camera
capture is out of scope for V1). Anonymous like/save taps show a
polished sign-in prompt (`src/lib/auth/requireAuthPrompt.ts`) rather than
silently failing or navigating away immediately.

"Source this look": a restrained CTA on every post navigates to the
existing Source tab placeholder (`src/app/(tabs)/source.tsx`) without
faking an integration — native sourcing creation (`POST
/api/v1/sourcing`) does not exist yet, so no context/image prefill is
possible today. Wiring real prefill is the concrete next Explore→Sourcing
integration task once native sourcing creation ships.

---

# 12B. Beauty Services / Professional Discovery — implemented M22 (client-designated)

**Numbering note:** this is the client-designated "M22" (Beauty Services /
Professional Discovery), a different track from §47's own internal "M22 ---
Vendor Business Core" milestone (native listings/orders/fulfilment), which
remains not-yet-implemented and is intentionally left renumbered/untouched
below — the two "M22"s are not the same milestone. This section is inserted
here (after §12A) rather than renumbering the rest of the document, same
convention as §12A's own insertion after §12.

This is explicitly **not** Careers (M23 — people seeking employment/gigs),
**not** Explore, **not** Shop, and **not** a customer-posted jobs board. A
Beauty Professional is an established professional/business (Makeup Artist,
Hairstylist, Wig Installer, Nail Technician, Lash Technician, Barber,
Braider, Beautician, Bridal Beauty Professional, etc.) discoverable by
customers, who submit a structured request for one of their offered
services rather than contacting the provider directly.

## 12B.1 Intermediary / privacy rule

CrownSourceGlobal never exposes a provider's phone/email/WhatsApp/social
link publicly, and there is no customer↔provider direct messaging in M22.
The flow is Customer → CrownSource → Provider: a customer submits a
structured `ServiceRequest`, the provider accepts/declines through the
platform, and CrownSource remains the intermediary throughout. Day-of
contact/coordination details (once a request is accepted) are handled by
CrownSourceGlobal operations outside the product for V1 — in-platform
messaging for an accepted request is explicitly deferred (see §12B.9).

## 12B.2 Domain model chosen

`BeautyProfessionalProfile` — a small, **optional** 1:1 extension of an
already-`APPROVED` `Vendor` (`vendorId @unique`), not a second User/auth
system and not automatically granted. This mirrors `ExplorePost`'s M21
publisher-identity decision (the smallest existing identity that already
carries a public name/logo/location and a real moderation relationship with
CrownSource) rather than inventing a new Provider domain — but unlike
`ExplorePost`, becoming a public Beauty Professional is its own gated
decision, not implied by Vendor approval alone.

**Why product vendors aren't automatically professionals:** a wholesale
cosmetics supplier is a real, approved `Vendor`, but is not a makeup artist.
`BeautyProfessionalProfile.status` (`DRAFT → PENDING → APPROVED /
CHANGES_REQUESTED / REJECTED`, plus vendor-initiated `ARCHIVED`) is the one
moderated decision: may this Vendor present publicly as a Beauty
Professional at all. Tested explicitly in
`modules/beauty-professionals/service.test.ts` ("a product-only vendor has
no Beauty Professional profile and never appears on the public feed").

Unlike `VendorListing`/`ExplorePost`, a profile has **no `pendingChanges`
staging** — once `APPROVED`, further edits to bio/displayName/specialties/
locationMode/heroImageUrl apply immediately with no new review. This is a
deliberate simplification, justified by precedent already in this codebase:
Vendor's own storefront settings (`modules/vendors/repository.ts`'s
`updateStoreProfile`) have never had an approval step either, and a
profile's text fields carry no new photo content to re-moderate (portfolio
imagery is Explore's job — see §12B.3). Editing an `ARCHIVED` profile
republishes it directly (`APPROVED`) — it was already vetted once. Only the
first-time "may this Vendor go public" decision is moderated.

## 12B.3 Portfolio ↔ Explore relationship

Deliberately **not** a second photo system. A professional's public
portfolio is simply their own approved+published `ExplorePost` rows,
resolved live by `vendorId` at detail-read time
(`modules/beauty-professionals/repository.ts`'s `findPublicById`). A hero
image is a plain external URL field (`heroImageUrl`), the exact same
convention as `Vendor.logoUrl` — no new upload flow was built for it.

## 12B.4 Category strategy

Reuses the exact same `EXPLORE_CATEGORY_SLUGS` taxonomy M21 already
established (Wigs / Makeup & Cosmetics / Lashes & Brows / Skincare /
Hairstyling / Nails / Barbering) for both a professional's
`specialtyCategorySlugs` and each `BeautyService.categoryId` — never a
third category universe. The mobile client reuses Explore's own
`GET /api/v1/explore-posts/categories` endpoint/hook for the category chip
row; no new categories endpoint was added.

## 12B.5 Service + request model

`BeautyService` — the smallest sellable-unit analogue for a service (name,
optional description, a shared beauty `Category`, an optional indicative
`startingPrice`, `active` flag). Never modeled as a `VendorListing` — no
fake inventory/shipping/MOQ semantics for a service.

`ServiceRequest` — the entire V1 booking workflow:
`SUBMITTED → PROVIDER_ACCEPTED / PROVIDER_DECLINED`, plus
customer-initiated `CANCELLED` while still `SUBMITTED`. Fields: selected
service, `preferredDate`, a free-text `preferredTimeNote` (e.g. "Morning" /
"Flexible" — deliberately not a time-slot booking engine),
`locationMode` (`PROVIDER_LOCATION` / `CUSTOMER_LOCATION` — validated
against what the professional actually supports), `locationDetails`,
`notes`, `quantity`, and an optional single reference/inspiration photo
(reuses the M13 `StorageProvider` abstraction, same validated-upload
pattern as Explore's images, bounded to one image not 1–6). No payment,
escrow, scheduling calendar, or chat — see the schema's section-header
comment for the full explicitly-deferred list.

Admin gets full read visibility over both profiles and requests via a
moderation queue (`/admin/beauty-professionals`) and an operational list
(`/admin/service-requests`) — no `ADMIN_NEW_*` notification for either,
same established precedent as `ExplorePost` (admin uses the queue/list as
the discovery mechanism, not a push notification, for every new
submission/request).

## 12B.6 Public API

`GET /api/v1/beauty-professionals` — public, unauthenticated, cursor-
paginated (same `createdAt desc, id desc` opaque-cursor convention as
Explore's feed), `?category=<slug>` and `?q=<text>` (simple
case-insensitive `displayName` search — no search infrastructure added).
`GET /api/v1/beauty-professionals/[id]` — public detail: profile + active
services + portfolio (only an `APPROVED` profile resolves; anything else
404s, same as an unapproved listing/Explore post).

`POST /api/v1/service-requests` — authenticated only, `multipart/form-data`
(the one mutating public-facing endpoint this milestone adds), validates
the service belongs to the given professional and is active, the location
mode is supported, and the preferred date isn't in the past.
`GET /api/v1/service-requests` / `GET .../[id]` — the caller's own requests
only (ownership-scoped, page-paginated). `DELETE /api/v1/service-requests/[id]`
— customer cancellation while still `SUBMITTED`.

Every public DTO (`lib/api/dto/beauty-professionals.ts`,
`lib/api/dto/service-requests.ts`) excludes `Vendor.contactEmail`/
`contactPhone` and any other private field — tested explicitly in both
`modules/beauty-professionals/service.test.ts` and
`app/api/v1/beauty-professionals/route.test.ts`.

## 12B.7 Mobile integration

`src/app/beauty-services/{index,[id],request,my-requests}.tsx` — a
dedicated stack reached from a Home capability card (`Beauty Services`,
alongside Marketplace/Explore/Source/Account), **not** a sixth bottom tab —
the existing five (Home/Explore/Shop/Source/Account) stay as the primary
navigation, consistent with §19's "preserve a maximum of roughly five
primary bottom-tab destinations."

Browsing (discovery list + professional detail) is fully public, no sign-in
required (§13's principle applied here too). "Request Service" is gated:
a signed-out tap shows the same `promptSignInRequired` Alert pattern
Explore's like/save already established, redirecting to sign-in with a
`redirect` param that returns the customer to the exact intended request
(`professionalId`/`serviceId` preserved in the query string) once
authenticated. `BeautyProfessionalCard` is a purpose-built component —
deliberately not `ProductCard` (Shop's commerce grid) or `ExplorePostCard`
(Explore's full-bleed feed) — a compact horizontal row so a list of
professionals reads like a trusted directory. No rating/review/badge/
years-of-experience anywhere — none of that is real persisted data in M22.

`src/app/beauty-services/request.tsx` collects service selection, a
relative-date quick-pick (Tomorrow / In 3 days / Next week / In 2 weeks —
no native calendar-picker dependency was added; see §12B.9), a broad time
preference, the supported location mode(s), free-text location details/
notes, and an optional single reference photo via `expo-image-picker`.
`src/app/beauty-services/my-requests.tsx` is the customer's request
history (Explore's Saved-list pattern, reused for this domain), reachable
from a real, wired "Service requests" row in Account for a signed-in user.

## 12B.8 Web (Vendor Portal + Admin)

Extends the existing Vendor Portal rather than building another web
application (§16's principle): `/vendor/portal/beauty-professional`
(profile create/edit + take-down), `.../services` (service CRUD), and
`.../requests` (incoming requests, accept/decline). Profile/service
creation and request accept/decline are **web-only** for M22 — the mirror
image of Explore's "post creation is mobile-only" decision, and for the
same reason: native provider/vendor management is explicitly out of scope
for M22 (§16), and the web Vendor Portal already has the right form/table
primitives for this. Admin gets `/admin/beauty-professionals` (moderation
queue + decision forms, mirroring `/admin/explore-posts` exactly) and
`/admin/service-requests` (read-only operational list + detail — the
accept/decline decision belongs to the provider, not Admin).

## 12B.9 Explicitly deferred / known limitations

- Customer↔provider in-platform messaging once a request is accepted (day-
  of coordination is manual CrownSource-ops work for V1).
- A native date/time picker — the request flow uses relative quick-pick
  presets instead of adding a new native dependency untested in this pass.
- Quantity/"number of people" has no dedicated UI control in V1 (defaults
  to 1; a multi-person need can be described in the free-text notes) —
  the schema field exists for a future UI addition without a migration.
- Payment/escrow/provider payout, a scheduling calendar, and fake ratings/
  reviews/badges/response-time/years-of-experience — none built, per the
  milestone brief.
- No customer-facing web browsing page for Beauty Services was built —
  mobile is the primary discovery surface (same asymmetry as Explore); the
  only new customer-facing web page is `/account/service-requests` (a
  read-only request-history mirror, so the notification-email CTA lands
  somewhere real).

## 12B.10 M22.1 — real-device integration hardening

Real-iPhone acceptance testing (Expo Go) surfaced four issues, all fixed or
explicitly documented rather than worked around:

1. **`BeautyProfessionalProfile.heroImage`** (renamed from `heroImageUrl`)
   is now a real Choose/Take-Photo upload through the existing M13
   `StorageProvider`, never a pasted external URL — see
   `modules/beauty-professionals/image-validation.ts` and the schema doc
   comment. This was the first case of a wider, now-documented product
   rule: **user-managed images must be file/photo uploads, never a pasted
   URL** (external links — Instagram/TikTok/website — are unaffected).
   `Vendor.logoUrl` is the one other confirmed instance of the old pattern;
   deliberately NOT touched this pass (blast radius: 2 backend DTOs, 3 web
   page renders, ~6 mobile read sites) — flagged for a future milestone.
2. A demo-seeding bug (double-JSON-encoding an `ExplorePost.images` Json
   value) crashed the ENTIRE Beauty Professional detail endpoint for any
   profile whose portfolio included the malformed row, because the DTO
   mapper cast `images` unsafely instead of using the same defensive
   `Array.isArray(...) ? value : []` guard `modules/explore-posts/repository.ts`
   already established. Fixed by reusing that guard
   (`modules/beauty-professionals/repository.ts`); regression test added.
   A single malformed/missing image must never break an entire API
   response or entire screen — the mobile side now has a shared
   `FallbackImage` component (`src/components/ui/FallbackImage.tsx`)
   applied to every Beauty Services image surface (discovery card, hero,
   portfolio grid) for the same reason on the client side.
3. Google native Sign-In cannot be exercised end-to-end against a bare
   local LAN backend (Expo Go or a dev build) — Google's OAuth policy only
   accepts a plain-HTTP redirect URI for `localhost`/`127.0.0.1`, never a
   LAN IP, so `BETTER_AUTH_URL` (which Better Auth uses to build the Google
   `redirect_uri`) must stay `http://localhost:3000`, which a physical
   phone cannot itself resolve back to the Mac. Not a bug — a real
   environment constraint, requiring either an HTTPS tunnel for the local
   backend or testing against a deployed staging backend. Full runbook:
   `../crownsourceglobal-mobile/README.md`'s "Authentication on a physical
   device (M22.1)" section.
4. Email verification "not arriving" locally is the intended zero-config
   dev behavior (`EMAIL_PROVIDER` defaults to `console`, which prints the
   email to the `npm run dev` terminal instead of calling Resend — verified
   directly, no error was being swallowed). Verification is deliberately
   web-only by design already (`src/app/(auth)/verify-email.tsx`), so the
   fix is workflow documentation, not code: open the printed link in a
   browser on the same Mac, or configure Resend + set `NEXT_PUBLIC_APP_URL`
   to the LAN IP to receive it on the phone itself. Same README section
   covers this.

---

# 13. Saved / Favorites

Explore should ship with a useful lightweight engagement mechanism.

V1 recommendation: **Save**, rather than public Like.

Users should be able to save an approved listing from:

- Explore;
- Shop;
- Product Detail.

Account includes:

```text
Saved
```

The backend owns saved state.

A likely data relationship is User/Customer ↔ Listing, but the final
schema should follow an audit before migration.

Do not add public like counts unless explicitly scoped.

---

# 14. Search and Discovery

V1 search should support the existing catalogue cleanly.

Requirements:

- text search;
- category browsing;
- relevant existing filters;
- pagination/cursor strategy suitable for mobile;
- loading states;
- empty states;
- retry states.

Do not build Elasticsearch/Algolia solely because a native app exists.
Introduce dedicated search infrastructure only when the current
database/search approach demonstrably becomes inadequate.

---

# 15. Custom Sourcing

Custom sourcing is a core differentiator and should be a first-class
native flow.

Mobile advantage:

- camera/photo library;
- screenshots;
- easy image upload.

Example:

```text
Describe what you need
      ↓
Take/select reference photos
      ↓
Quantity
      ↓
Destination
      ↓
Specifications/details
      ↓
Submit
      ↓
Track request
      ↓
Receive quotation
      ↓
Accept / checkout
```

Do not integrate Google Lens in V1 merely because image-based sourcing
exists.

Uploading a reference image already solves the principal user problem.

Image recognition/search may be evaluated later if a concrete use case
exists.

---

# 16. Quotations

Mobile should reuse the existing quotation workflow.

Customer can:

- view quotation;
- see items;
- amount;
- expiry;
- status;
- Vendor information where permitted;
- Admin note where applicable;
- proceed to checkout when allowed;
- request/update according to existing workflow;
- download/open quotation PDF.

Do not recreate quotation calculations in React Native.

---

# 16A. Native Sourcing & Quotation Flow — implemented M24

M24 replaced the Source tab's placeholder with the real photo-first
sourcing flow, and added customer-facing quotation viewing/acceptance.
Everything below is built on the EXISTING M6 sourcing/quotation backend —
no second business layer.

## 16A.1 Backend architecture reused unchanged

- **Entities**: `CustomSourcingRequest` (+ `SourcingRequestAttachment`,
  `SourcingOption`, `SourcingAllocation`, `SourcingRequestActivity`, all
  staff/admin-only) and `Quotation`/`QuotationItem` (M5/M6, shared between
  INSTANT bulk-cart quotes and CUSTOM_SOURCING quotes).
- **Sourcing state machine**: `SUBMITTED → UNDER_REVIEW → SOURCING →
  (AWAITING_CUSTOMER ⇄ SOURCING) → QUOTED → ACCEPTED`, with
  `UNABLE_TO_SOURCE`/`CANCELLED` terminal branches — unchanged, owned by
  `modules/sourcing/service.ts`.
- **Quotation state machine**: `ISSUED → ACCEPTED`, or `ISSUED → EXPIRED`
  (derived, not a background sweep) or `ISSUED → SUPERSEDED` (reissue) —
  unchanged, owned by `modules/quotation/service.ts`. There is no "reject"
  action on either the web or mobile customer surface — an unwanted
  CUSTOM_SOURCING quote is simply left to expire; mobile does not invent one.
- **Quote acceptance → Order**: `ordersService.createOrderFromQuotation`
  (unchanged) — same atomic Quotation-status claim, same idempotency
  guarantee (a repeat accept call returns the existing `orderId`), same
  `InventoryReservation`/Fulfilment-fan-out path a web-originated Order
  already used. Mobile calls this exact function through a new route; it
  does not re-derive or duplicate any of this logic.
- **Storage**: sourcing attachments stay on the EXISTING private,
  session-authenticated download route
  (`app/api/sourcing/attachments/[id]`) — deliberately NOT the
  unauthenticated-but-unguessable-key convention listing/explore-post/
  service-request images use, because a sourcing attachment can be a
  non-image document and was already scoped to "owning customer or staff
  only". A native client attaches its session cookie itself when fetching
  these URLs (see `attachmentImageSource.ts` on mobile) — same requirement
  a browser already satisfies automatically. Up to
  `MAX_ATTACHMENTS_PER_REQUEST` (5) images were already supported before
  M24 — no schema change was needed to support multiple reference photos.

## 16A.2 One shared-layer domain change: photo-first submission

`modules/sourcing/service.ts`'s `submitRequest` validation changed from
"title AND description both required" to "description required only when
no attachment is present" (`SourcingRequestInput.title` is now optional).
When `title` is omitted, it's derived server-side from the description's
first line (truncated) or a generic "Photo sourcing request"/"Sourcing
request" fallback — never invented on the client, never duplicated between
web and mobile. The web form is unaffected (it still always submits a
title). This is the one change to shared business logic M24 made; every
other engineering rule (checkout integrity, quotation snapshots, financial
separation) was left untouched.

## 16A.3 Mobile APIs added (all thin — call the existing services only)

```text
GET  /api/v1/sourcing-requests            paginated, own requests, newest first
POST /api/v1/sourcing-requests            multipart, up to 5 `attachments` file parts
GET  /api/v1/sourcing-requests/:id        ownership-scoped detail

GET  /api/v1/quotations                   paginated, own quotations, newest first
GET  /api/v1/quotations/:id               ownership-scoped detail
POST /api/v1/quotations/:id/accept        JSON body = lib/delivery-schema.ts's deliverySchema

GET  /api/v1/me/addresses                 saved delivery addresses, for the accept-flow prefill

GET  /api/v1/orders/:id                   DELIBERATELY MINIMAL (orderNumber/status/paymentStatus/
                                           total/currency only) — added ONLY to back the honest
                                           "order pending payment" confirmation after acceptance.
                                           Not a general Orders API — no list route, no vendor/
                                           fulfilment breakdown. Full native Orders is M25's scope.
```

## 16A.4 Native image upload — same proven M23 pipeline

`prepareImage.ts` (`src/lib/media/prepareImage.ts`) generalizes M23's
Careers `prepareWorkPhoto.ts` (1600px longest-side resize, 0.7 JPEG
recompression) so Source reuses the exact same proven pipeline; Careers'
`prepareWorkPhoto.ts` is now a one-line wrapper around it (regression-
verified: `tsc`/`lint` pass, behavior unchanged). Photos are appended to
`FormData` as `expo-file-system` `File` instances — `new File(photo.uri)`
— never the legacy React Native `{ uri, name, type }` shape, which Expo's
spec-compliant Winter fetch rejects (`useCreateSourcingRequest.ts` mirrors
`useSubmitTalentApplication.ts`'s exact pattern, including the `__DEV__`
FormData-part-shape console log). Content-Type/multipart boundary is left
to `fetch` — never set manually. No base64.

Note for a future pass: `beauty-services`'s M22-era
`useCreateServiceRequest.ts` still uses the legacy `{ uri, name, type }`
pattern (it predates the M23 fix) — not touched in M24 (out of scope), but
flagged here since it's a real latent physical-device bug in an existing
feature, same class as the one M23 fixed.

## 16A.5 Photo-first Source screen

`src/app/(tabs)/source.tsx` — Photo (camera or library, up to 5, resized/
compressed) → Description (optional once a photo exists, required
otherwise) → Quantity stepper → Delivery country (searchable picker —
`src/constants/countries.ts`, mirrors the web `CountrySelect` list
exactly) + optional region/city free text → Submit. No title field, no
specifications/budget/category/required-by fields — those stayed
web-only (richer RFQ detail), consistent with "do not turn this into a
giant enterprise RFQ form" and "minimize typing". Visible and fully
fillable while signed out; sign-in is only required at Submit
(`promptSignInRequired`) — because Source is a tab screen rather than a
pushed route, the filled-in draft simply stays mounted underneath the
sign-in screen and is intact on return, which satisfies "preserve draft
where reasonably simple" without a server-side draft mechanism.

## 16A.6 History, detail, and quotation screens

- `src/app/sourcing/my-requests.tsx` — paginated history (reachable from
  Account → "Sourcing requests" and a header icon on Source itself),
  thumbnail + customer-friendly status badge, mirrors
  `beauty-services/my-requests.tsx`'s list pattern exactly.
- `src/app/sourcing/[id].tsx` — consumer request tracker: swipeable photo
  gallery, description, quantity, delivery, status, and a "Your quotation
  is ready" card linking into the quotation screen when one exists.
- `src/app/quotations/index.tsx` / `src/app/quotations/[id].tsx` — list and
  detail (reference, line items, subtotal/total, status, expiry). Detail
  exposes "Accept quotation" (ISSUED only) behind a delivery-details form
  (saved-address quick-select from `/api/v1/me/addresses`, region picker
  constrained to `GHANA_REGIONS` — the same list `DeliveryInfo.region`
  server-side validation already enforces). EXPIRED shows an explanatory
  notice; ACCEPTED shows the real order number/total via
  `useOrderSummary` and an explicit "in-app payment is coming soon" note —
  never a faked "paid" state (M25 owns native payment).

## 16A.7 Status label mapping

Backend enum values are never shown raw. `SourcingStatusBadge`/
`QuotationStatusBadge` (mobile) consume the already-humanized
`statusLabel` the backend computes (`modules/sourcing/service.ts`'s
`STATUS_LABELS`) — the mobile components only choose a badge tone, never
re-derive customer copy.

## 16A.8 Admin fix: attachment review (§15 of the M24 brief)

The admin sourcing detail page's attachment section was a bare filename
link list — staff had to open every file in a new tab to compare photos
before an operational decision, the same gap already flagged for Listing
moderation. `components/sourcing/AttachmentGallery.tsx` now renders a
thumbnail grid with a lightbox for images (non-image files stay a plain
download list), still pointed at the same private, session-authenticated
`/api/sourcing/attachments/[id]` route — no new storage/access path.

## 16A.9 Explicitly deferred / known limitations

- No reject/decline action for a quotation — none exists on the web
  customer surface either (see §16A.1); an unwanted quote just expires.
- No push notifications for "quotation ready"/"quotation expiring" — no
  native push infrastructure exists yet (§21.2 is still unimplemented).
- No native payment after quote acceptance — the created Order is
  correctly `PENDING_PAYMENT`; full native checkout/Paystack is M25.
- No general native Orders feature (list, tracking, fulfilment
  breakdown) — `GET /api/v1/orders/:id` added in M24 is intentionally
  minimal, only for the post-acceptance confirmation card.
- `specifications`/`budgetAmount`/`budgetCurrency`/`categoryId`/
  `requiredByDate` are not collected on mobile (web-only richness) — the
  backend already treats every one of them as optional, so omitting them
  client-side is fully backward compatible.
- Non-image sourcing attachments (PDF/CSV/XLSX) are accepted by the
  shared backend validator (unchanged) but the mobile detail screen only
  renders image attachments — a customer submitting from mobile only ever
  produces images (camera/library), so this only matters for a request
  that also has a document attached via the web form.

---

# 17. Cart and Checkout

Mobile cart must use the same backend pricing and inventory rules as
web.

Never trust client-calculated:

- totals;
- discounts;
- unit price;
- availability;
- inventory reservation;
- shipping amounts.

The mobile app may display calculated values returned by the server, but
the server remains authoritative.

Checkout should preserve the existing order/payment state machine.

---

# 18. Payments

## 18.1 Principles

Paystack remains the payment provider unless separately changed.

Never embed:

- Paystack secret keys;
- webhook secrets;
- database credentials;
- sensitive provider credentials

inside the mobile bundle.

## 18.2 Flow

Conceptually:

```text
Mobile app
    ↓
Backend initializes transaction
    ↓
Paystack secure payment experience
    ↓
Callback/deep link
    ↓
Backend verifies transaction
    ↓
Backend updates payment/order
    ↓
Mobile fetches authoritative result
```

A client-side "success" screen alone must never mark an order paid.

Webhooks/server verification remain authoritative.

## 18.3 Store Payment Rules

Before release, verify current Apple App Store and Google Play billing
requirements.

CrownSourceGlobal primarily sells physical goods/services rather than
digital app content, so platform in-app-purchase rules must be evaluated
against the exact V1 offering at release time.

Do not assume rules; verify immediately before submission.

---

# 18A. Native Cart, Checkout & Payments — implemented M25

M25 completed the standard commerce journey (Shop → Product → Cart →
Checkout → Paystack → Order Confirmation) on mobile, entirely on the
EXISTING web/backend cart, checkout, pricing, inventory-reservation,
order, and Paystack payment services — no second business layer, no new
payment provider.

## 18A.1 Backend architecture reused unchanged

- **Cart**: `Cart`/`CartItem` (`modules/cart/service.ts`) — Cart is
  `CustomerProfile`-owned with no anonymous/guest cart in the approved
  model (see `prisma/schema.prisma`'s `Cart` doc comment). No price is
  stored on `CartItem`; unit price is always resolved live against current
  `VendorListing`/`BulkPriceTier` data at read time
  (`resolveUnitPrice.ts`).
- **Checkout transaction**: `ordersService.createOrderFromCart`
  (unchanged) — inside one Prisma transaction: re-reads each listing fresh
  (never trusts the cart snapshot), re-validates `listingStatus === "ACTIVE"`/MOQ/maxOq,
  atomically conditional-decrements `VendorListing.availableQuantity`
  (`updateMany` with a `gte` guard — the actual oversell guard), creates
  the `Order` + `OrderItem`s (first point standard-path pricing becomes
  authoritative, per CLAUDE.md §33.3), creates one `InventoryReservation`
  per line with a 15-minute `expiresAt`, and marks the source `Cart`
  `CONVERTED`.
- **Payments**: `modules/payments/service.ts` — Mobile Money
  (`initiateMobileMoneyPayment`/`submitMobileMoneyOtp`, provider-neutral,
  Paystack primary as of M10A.2) and Card (`initiateCardPayment`, always
  Paystack-hosted Checkout regardless of `env.PAYMENT_PROVIDER`). Every
  verification path — customer poll, card return, and the Paystack
  webhook — funnels through the same `applyVerifyOutcome`, which
  independently re-verifies via the provider's own Verify Transaction
  endpoint before ever confirming an Order (a webhook body's claimed
  status is never sufficient alone), checks amount/currency match, and
  guards the SUCCEEDED transition with a `updateMany` on
  `status IN (INITIATED, PENDING)` so a duplicate caller can only ever win
  once. `ordersService.confirmOrderPayment` (unchanged) then commits the
  reservations, fans out one `Fulfilment` per distinct vendor, and creates
  `VendorEarning` rows — identical to the web path.
- **Quotation-originated orders**: `ordersService.createOrderFromQuotation`
  (M24, unchanged) already produces a normal `PENDING_PAYMENT` Order with
  no `originQuotationId`-specific payment branch — it pays through the
  exact same `/orders/:id/payments/*` endpoints M25 added, so the M24
  "Pay now" gap (previously an honest "in-app payment is coming soon"
  note) is now closed without any quotation-specific payment code.

## 18A.2 Guest cart decision

Cart requires a signed-in customer (matches the schema comment above and
the existing web behavior). Catalogue browsing (Shop, Product Detail)
stays fully public; only *Add to Cart* gates on auth, using the same
`promptSignInRequired(action, redirectTo)` pattern M21/M22/M24 already
established for likes/saves/sourcing/service-request submission — no
local-only guest cart, no client-side cart/server-cart reconciliation
engine. This is the "reuse the backend's own guest/session-cart support if
it exists, otherwise don't build a synchronization engine" call from the
M25 brief: the backend has no guest-cart support at all, so there is
nothing to reconcile.

## 18A.3 Mobile APIs added (all thin — call the existing services only)

```text
GET    /api/v1/cart                                  vendor-grouped CartView, live-resolved pricing
POST   /api/v1/cart/items                             { listingId, quantity } → refreshed CartView
PATCH  /api/v1/cart/items/:id                          { quantity } → refreshed CartView (0 removes the line)
DELETE /api/v1/cart/items/:id                          → refreshed CartView

POST   /api/v1/checkout                                deliverySchema body → { orderId } (cart → PENDING_PAYMENT Order)

POST   /api/v1/orders/:id/payments/mobile-money         { network, phone }
POST   /api/v1/orders/:id/payments/mobile-money/otp     { paymentId, phone, otpcode }
POST   /api/v1/orders/:id/payments/card                 → { payment, authorizationUrl }
GET    /api/v1/payments/:id                             bounded customer status poll (re-verifies when stale)
```

Every route: `getCurrentSession`/`getCurrentCustomerProfile` auth gate,
then a thin call into the existing `cartService`/`ordersService`/
`paymentsService` — no route contains business logic. Money fields are
serialized as `{ amount: "12.34", currency: "GHS" }` via the existing
`serializeMoney` convention (`lib/api/dto/cart.ts`,
`lib/api/dto/payments.ts`). `checkout` and both payment-initiation routes
reuse the exact same rate limits as their web server-action equivalents
(`lib/actions/checkout.ts`/`lib/actions/payment.ts`); the client-IP key
they need is read directly off the Route Handler's own `Request`
(`lib/api/request-ip.ts`) rather than `next/headers()`'s `headers()`,
mirroring the pattern `app/api/v1/talent-applications/route.ts` (M23)
already established — `headers()` requires Next's request-scope async
storage, which breaks calling a route handler directly in a test.

There is deliberately no `GET /api/v1/orders/:id/payments/card/return`
route — see §18A.4.

## 18A.4 Native Paystack flow

**Mobile Money** is a fully native form (network picker, phone number,
optional OTP step) — no WebView, no redirect. Same state machine as the
web `MobileMoneyPaymentForm`: form → (otp) → pending/poll → succeeded
(navigate to confirmation) / failed (retry) / stalled (manual "Check now"
after ~2 minutes of polling, same ceiling as web's `MAX_POLLS`).

**Card** is always Paystack-hosted Checkout, opened via
`expo-web-browser`'s `WebBrowser.openBrowserAsync(authorizationUrl)` (a
dismissible in-app browser tab, not a custom-scheme redirect flow).
CrownSourceGlobal's mobile app never collects, sees, or stores a card
number/CVV/PIN/OTP.

**Why there is no deep-link return path for payment**: the backend's
`initiateCardPayment` hard-codes its Paystack `callback_url` to the WEB
confirmation page (`${NEXT_PUBLIC_APP_URL}/checkout/:orderId/payment/callback`),
and that page requires a Better-Auth WEB browser session cookie — which
the in-app browser tab does not share with the native app's own
SecureStore-based session. Reusing or redirecting that callback into the
app via `crownsourceglobal://` would have meant either (a) modifying
shared backend payment-initiation logic to accept a caller-supplied
callback URL (touching business logic children other than mobile
consume), or (b) wiring a new deep-link route and reconciling it with
Better Auth's own existing `crownsourceglobal://` auth deep links (the
M25 brief's explicit "use separate, explicit payment return paths, don't
break auth deep links" warning). Instead, the moment
`WebBrowser.openBrowserAsync` resolves (the customer dismisses the tab —
whether they completed payment, closed it, or Paystack's own page
redirected there), the mobile client independently polls
`GET /api/v1/payments/:id` using its own authenticated app session. That
poll re-verifies against Paystack itself through the exact same
`applyVerifyOutcome` funnel the web callback page and the webhook both
use — so the result is honest regardless of what the browser tab
displayed, and regardless of whether the web callback page could even
render (it usually can't, for a mobile-only customer with no browser
session). This is simpler than a deep-link round trip and makes the same
correctness guarantee.

## 18A.5 Verification / webhook authority / idempotency

Unchanged from the existing architecture, reused as-is:

- The mobile app **never** calls Paystack directly — every status check
  goes through CrownSourceGlobal's own server
  (`GET /api/v1/payments/:id` → `paymentsService.getPaymentStatusForCustomer`),
  which only calls out to the provider when its last verification is
  stale (>4s), exactly like the web polling action.
- The Paystack **webhook** (`app/api/payments/paystack/webhook/route.ts`,
  unchanged) remains authoritative independent of whatever the mobile
  client's poll shows — both paths converge on the same
  `applyVerifyOutcome`/`ordersService.confirmOrderPayment`, so a
  confirmation can arrive via the webhook even if the customer's device
  never successfully polls (e.g. they closed the app after payment).
- **Idempotency**: a duplicate mobile-money/card initiation resumes the
  same active attempt via the existing `payment_one_active_per_order`
  partial unique index (unchanged) — no separate mobile-side idempotency
  key was added, none was needed. A duplicate webhook delivery, a race
  between the mobile poll and the webhook, and a retried failed attempt
  all still confirm the Order at most once, guarded by the existing
  `updateMany(status IN (INITIATED, PENDING))` claim in
  `applyVerifyOutcome` — this is exactly what
  `modules/payments/paystack.service.test.ts`'s pre-existing
  "duplicate webhook callbacks confirm the order exactly once" and
  "retry... confirms the order exactly once" tests already prove, and M25
  added no new confirmation path for those tests to miss.

## 18A.6 Security boundaries verified

- Cart/checkout/payment routes are ownership-scoped exactly like every
  other `/api/v1` route (`customerProfileId` from the session, never a
  client-supplied id) — IDOR attempts (Customer B mutating/reading
  Customer A's cart item, initiating/polling Customer A's payment) return
  `NOT_FOUND`/a validation error, never another customer's data (see
  regression coverage in §18A.7).
- The client sends only `listingId`/`quantity` (cart) and delivery details
  (checkout) — never a price or total; checkout/payment amounts are always
  server-derived from the live `Order`/`Payment` row.
- The Paystack secret key and webhook signing behavior stay entirely
  server-side (`env.PAYSTACK_SECRET_KEY`, never `NEXT_PUBLIC_*`) — nothing
  payment-provider-secret reaches the mobile bundle. The only value that
  ever reaches the client is Paystack's own hosted `authorizationUrl`
  (opened in a browser, never parsed for secrets).

## 18A.7 Backend regression coverage added

8 new route test files (30 tests), integration-style against the real
local Postgres dev DB, same convention as every existing `/api/v1` route
test:

```text
app/api/v1/cart/route.test.ts                                    GET: auth required, Money-shaped DTO
app/api/v1/cart/items/route.test.ts                               POST: auth, MOQ rejection, happy path, validation
app/api/v1/cart/items/[id]/route.test.ts                          PATCH/DELETE: IDOR, owner success, qty-0 removal
app/api/v1/checkout/route.test.ts                                 empty cart, invalid delivery, happy path
                                                                    (reservation + atomic decrement + cart CONVERTED),
                                                                    oversell rejection (never partially decrements)
app/api/v1/orders/[id]/payments/mobile-money/route.test.ts        auth, invalid network, IDOR, happy path
app/api/v1/orders/[id]/payments/mobile-money/otp/route.test.ts    auth, IDOR, OTP resubmission, validation
app/api/v1/orders/[id]/payments/card/route.test.ts                auth, IDOR, authorizationUrl passthrough
app/api/v1/payments/[id]/route.test.ts                            auth, IDOR, Money-shaped DTO
```

The Paystack HTTP boundary is mocked at the adapter
(`modules/payments/providers/paystack/adapter`) exactly like the existing
`modules/payments/paystack.service.test.ts` does — these route tests
verify routing/auth/ownership/DTO-shape, not business logic the
service-layer tests already cover exhaustively (MOQ, bulk pricing,
multi-vendor, duplicate webhooks, forged amounts, etc. — untouched by
M25, still passing).

## 18A.8 Explicitly deferred / known limitations

- No Apple Pay/Google Pay/saved cards/BNPL/wallet/new payment provider —
  not built, per the M25 brief.
- No general native Orders feature (list, vendor/fulfilment breakdown,
  shipment tracking, messaging) — `src/app/orders/[id].tsx` added in M25
  is intentionally minimal (order number/status/payment status/total/date
  only, reusing M24's existing minimal `GET /api/v1/orders/:id`), solely
  so checkout confirmation's "View Order" action and a quotation-order's
  "Pay now" retry have somewhere honest to go. Full Orders/Fulfilment is
  M26's scope; do not extend this screen ahead of that decision.
- No native push notifications for payment/order events — existing
  in-app/email notifications (`notificationsService`) continue to fire
  unchanged; no mobile-specific notification path was added.
- No physical-device or simulator manual E2E was performed this
  milestone (no device/simulator available in this environment) — see the
  M25 final report's AE/AG items. `npx tsc --noEmit`, `npx expo lint`, and
  `npx expo export` (a full Metro/React Compiler bundle pass) all succeed
  with the changes in place.
- The account tab's "Orders" menu item remains an intentional
  non-functional placeholder (pre-existing, not touched) — it needs a real
  order LIST endpoint, which does not exist yet and is M26 scope, not a
  single-order detail screen.

---

# 19. Vendor Listings and Media

Native Vendor listing creation should take advantage of phone media
capabilities.

Vendor can:

- take photo;
- choose from photo library;
- preview;
- remove before submission;
- upload multiple product images.

Reuse existing:

- image validation rules;
- Cloudflare R2/storage architecture;
- VendorListing.images semantics;
- moderation workflow.

The mobile app should upload through controlled backend/storage
endpoints rather than receive R2 administrative credentials.

Admin web must continue showing all proposed listing images before
moderation.

---

# 20. Careers / Talent

The existing Careers/Talent functionality is not necessarily required
for initial mobile release.

If included later:

- no CV requirement;
- guest/application behavior should be reconsidered for native UX;
- work samples remain private;
- existing TalentApplication/TalentWorkSample backend remains
  authoritative.

Do not delay core mobile commerce for Careers unless the client
explicitly prioritizes it.

---

# 21. Notifications

## 21.1 In-App

Reuse the existing Notification domain.

Mobile notification center should retrieve the same user-specific
notifications used by web.

Read/unread state must synchronize because it lives server-side.

## 21.2 Push Notifications

Push is a meaningful native advantage.

Potential V1/V1.1 push events:

### Customer

- quotation ready;
- order confirmed;
- fulfilment update;
- delivered;
- resolution update;
- sourcing update;
- message.

### Vendor

- application approved;
- listing approved/changes requested/rejected;
- new order;
- fulfilment action needed;
- resolution update;
- settlement/payout update;
- message.

Use Expo Notifications initially unless implementation requirements
justify another approach.

## 21.3 Device Tokens

Push token records should be associated with User/device safely.

Requirements:

- multiple devices per user;
- token refresh;
- token invalidation/removal;
- no assumption that one user has one device;
- notification preference enforcement;
- no secrets in push payloads.

---

# 22. Deep Linking

Deep links should be designed from the beginning even if push comes
later.

Examples:

```text
crownsourceglobal://orders/:id
crownsourceglobal://quotes/:id
crownsourceglobal://listings/:id
crownsourceglobal://sourcing/:id
```

Prefer universal/app links associated with the CrownSourceGlobal web
domain where practical so links can:

- open the app when installed;
- fall back to web when not installed.

Do not put sensitive authorization information in deep-link URLs.

Opening a deep link must still perform server authorization.

---

# 23. Offline Strategy

Full offline operation is explicitly **not a V1 requirement**.

The application should gracefully handle:

- no connection;
- timeout;
- retry;
- stale screen data;
- interrupted upload.

Do not build a complex offline synchronization engine initially.

Reasonable local persistence:

- authentication/session;
- harmless UI preferences;
- last selected Customer/Business mode;
- temporary form draft where clearly useful.

Server remains the source of truth.

---

# 24. Mobile State and Data Fetching

Do not mirror the entire database into global client state.

Separate:

### Server state

Products, orders, quotations, Vendor data, etc.

### Local UI state

Selected tab, open modal, draft field state, etc.

Choose a well-supported server-state strategy during implementation (for
example TanStack Query if justified), but do not add libraries before
the mobile scaffold audit determines actual needs.

Requirements:

- cache appropriately;
- refetch important transactional screens;
- invalidate after mutations;
- handle pagination;
- handle loading/error/empty states;
- never treat stale cached payment/order status as authoritative.

---

# 25. Mobile Technology Stack

## 25.1 Recommended

- React Native.
- Expo.
- TypeScript.
- Expo Router or React Navigation decision during scaffold; prefer the
  simplest approach compatible with required deep links/auth.
- Existing CrownSource backend.
- Better Auth-compatible mobile session integration.
- Cloudflare R2 via backend-controlled upload architecture.
- Paystack through approved mobile/web payment integration.
- Expo push infrastructure initially if suitable.

## 25.2 Why React Native + Expo

- Existing React/TypeScript expertise.
- One codebase for Android and iOS.
- Strong native-device integration.
- Camera/image picker.
- Push notifications.
- Deep links.
- Easier build/release tooling than maintaining Swift + Kotlin
  independently.
- Faster iteration for this team/project.

## 25.3 Explicitly Rejected for V1

### WebView/PWA wrapper

Not sufficient for the requested native product direction.

### Separate Swift and Kotlin apps

Unnecessary cost and complexity.

### Flutter

Viable generally, but provides less leverage from the existing
TypeScript/React skillset for this project.

---

# 26. Repository Strategy

Initial recommendation:

```text
crownsourceglobal/
    existing Next.js/backend repository

crownsourceglobal-mobile/
    Expo/React Native repository
```

Do not perform a large monorepo migration before mobile work starts.

Potential future structure if meaningful code contracts need sharing:

```text
crownsource/
  apps/
    web/
    mobile/
  packages/
    api-contracts/
    validation/
    shared-types/
```

Move only when actual duplication justifies it.

---

# 27. Design System

Mobile should retain the finalized CrownSourceGlobal identity:

- ivory/cream surfaces;
- espresso/near-black primary color;
- champagne/gold accent;
- CrownSourceGlobal wordmark treatment;
- no return to the retired green/forest brand palette.

However, do not mechanically copy desktop layouts.

Native design should prioritize:

- thumb reach;
- bottom navigation;
- touch targets;
- sheets/modals;
- native keyboards;
- safe areas;
- readable forms;
- responsive phones/tablets;
- accessibility;
- visual product imagery.

Customer and Vendor modes should feel related but operationally
distinct.

---

# 28. Responsive Device Scope

V1 must be tested on representative:

### iOS

- current/common iPhone sizes;
- at least one smaller-screen iPhone class;
- at least one modern larger iPhone class.

### Android

- common mid-range Android dimensions;
- smaller width (\~360dp class);
- larger modern device.

Tablet-specific layouts are not a launch blocker unless explicitly
contracted, but the app must not catastrophically break on larger
screens.

---

# 29. Security

Mobile introduces an untrusted distributed client. Assume users can
inspect or modify the app.

Never rely on hidden buttons for authorization.

Backend must enforce:

- authentication;
- Customer ownership;
- Vendor membership;
- Admin-only operations;
- listing moderation rules;
- order ownership;
- fulfilment ownership;
- quotation ownership;
- finance access;
- resolution access.

Never ship secrets in Expo public environment variables.

Mobile-accessible values may include public API base URL and non-secret
identifiers only.

Sensitive credentials remain server-side.

---

# 30. Privacy

Before store submission, document what data the mobile application
actually collects.

Potential data categories:

- name;
- email;
- phone number;
- delivery/contact information;
- Vendor business information;
- uploaded product/work/reference images;
- order/payment metadata;
- messages;
- notification/device tokens.

Do not claim data is not collected if the backend receives it.

Prepare a public privacy policy URL accessible without authentication.

The policy must accurately describe both web and mobile processing.

---

# 31. Permissions

Request device permissions only when needed.

Potential permissions:

### Camera

When Vendor/Customer chooses to take a listing or sourcing photo.

### Photo Library

When selecting images.

### Notifications

After explaining the benefit; avoid requesting immediately on first
launch without context.

Avoid unnecessary:

- contacts;
- microphone;
- precise location;
- tracking permissions.

If location-based features are later added, request the minimum required
permission at the moment of use.

---

# 32. Location

V1 should not require continuous/background location.

Delivery addresses and countries can use existing structured form data.

Future location-based features such as nearby salons/services should be
a separate scoped feature.

Do not add location permission solely because it is a mobile app.

---

# 33. Services --- Post-Core Expansion

Beauty services are strategically compatible with CrownSourceGlobal but
should be modeled separately from physical products.

Potential services:

- wig installation;
- braiding;
- makeup;
- lashes;
- nails;
- salon treatments.

A Service may require:

- provider;
- title;
- portfolio;
- location;
- duration;
- price;
- booking/request;
- availability.

Do not model a service as a VendorListing product with fake
inventory/shipping semantics.

Target after core Customer + Vendor mobile flows are stable unless
reprioritized.

---

# 34. Environments

At minimum maintain:

## Development

- local/dev API;
- local/dev database;
- development credentials;
- test Paystack;
- development SMS/test behavior.

## Production

- crownsourceglobal.org/backend;
- production database;
- production R2;
- production Paystack;
- production SMS;
- production OAuth.

A staging environment is strongly recommended before store launch if
operationally affordable.

Mobile builds must clearly know which API environment they target.

Never allow a development build to mutate production unintentionally.

---

# 35. Build Profiles

Expo/EAS build profiles should conceptually include:

```text
development
preview/staging
production
```

### Development

Developer-client/debugging.

### Preview

Internal testers/client acceptance.

### Production

Signed store build.

Production credentials and signing assets must be controlled securely.

---

# 36. Error Handling

Every important screen must support:

- initial loading;
- empty;
- error;
- retry;
- unauthorized/session expired;
- network unavailable.

Mutations should provide:

- submitting state;
- prevention of accidental duplicate taps where necessary;
- success state;
- recoverable error;
- server message when appropriate.

Do not show raw stack traces/provider errors to users.

---

# 37. Performance

Mobile V1 should:

- paginate feeds/catalogues;
- avoid loading original full-resolution images in thumbnail grids;
- use optimized image sizes;
- lazy-load noncritical content;
- avoid giant home API responses;
- avoid unnecessary sequential requests;
- compress/resize uploads appropriately without destroying quality;
- avoid excessive animation.

Performance should be measured on realistic Ghanaian mobile
network/device conditions, not only fast Wi-Fi and flagship phones.

---

# 38. Accessibility

Minimum V1 requirements:

- screen-reader labels for interactive icons;
- sufficient contrast;
- scalable/readable text;
- meaningful button labels;
- touch targets;
- keyboard behavior for forms;
- clear validation messages;
- images with useful accessibility labels where meaningful;
- do not communicate status by color alone.

---

# 39. Analytics and Crash Reporting

Before launch, choose minimal observability.

Recommended capabilities:

- crash/error reporting;
- app version/build identification;
- API error visibility;
- key funnel events.

Potential product events:

- onboarding completed;
- Vendor application started/submitted;
- product viewed;
- saved;
- add to cart;
- checkout started;
- sourcing submitted;
- Vendor listing submitted.

Do not instrument sensitive form contents or OTP/payment secrets.

Exact analytics provider is not locked by this document.

---

# 40. Versioning and Backward Compatibility

Mobile users do not all update immediately.

Backend deployments must consider currently supported app versions.

Requirements:

- app semantic/version build numbers;
- API compatibility;
- ability to identify client version in requests if needed;
- graceful deprecation;
- avoid requiring immediate updates for routine backend changes.

A forced-update mechanism should only be introduced if genuinely
necessary for security/compatibility.

---

# 41. Testing Strategy

## 41.1 Unit

Focus on:

- normalization;
- validation;
- mapping;
- local state utilities;
- role/mode decisions.

## 41.2 API/Integration

Critical flows:

- authentication;
- ownership;
- cart;
- checkout;
- orders;
- sourcing;
- quotations;
- Vendor listing lifecycle;
- fulfilment;
- finance visibility.

## 41.3 Device / Manual

Test real phones early, not only emulator/simulator.

Critical end-to-end Customer test:

```text
Install
→ authenticate
→ browse
→ product
→ cart
→ checkout
→ pay
→ order
→ notification
```

Critical sourcing test:

```text
Source
→ upload image
→ submit
→ Admin quotes on web
→ mobile receives/views quote
→ checkout
```

Critical Vendor test:

```text
Authenticate
→ Vendor onboarding
→ Admin approves on web
→ Business mode available
→ create listing with photos
→ Admin reviews/approves
→ listing becomes public
→ customer orders
→ Vendor sees order
→ fulfils sequentially
→ finance reflects result
```

---

# 42. Production Readiness Gates

Mobile V1 is not production-ready until:

- auth survives app restart;
- account ownership rules are verified;
- Google/phone auth tested on real devices;
- production SMS is working if phone OTP is advertised;
- Vendor mode authorization is server-enforced;
- image uploads work reliably;
- Paystack test and production flows are verified;
- payment callbacks/deep links work;
- order status cannot be forged by client;
- push/deep links route correctly if included;
- crash-free basic flows;
- no production secrets in bundle;
- privacy policy available;
- store metadata complete;
- client acceptance completed;
- Admin web/mobile synchronization verified.

---

# 43. App Store (Apple) Preparation

Requirements change over time; verify current Apple requirements
immediately before submission.

Planning checklist:

## Developer Account

- Apple Developer Program membership.
- Account should ideally be owned by the CrownSourceGlobal
  business/client rather than permanently by the developer.

## App Identity

Decide bundle identifier, e.g.:

```text
com.crownsourceglobal.app
```

Treat this as long-lived.

## App Store Connect

Prepare:

- app name;
- subtitle;
- description;
- category;
- keywords where applicable;
- support URL;
- privacy policy URL;
- marketing URL if desired;
- screenshots;
- app icon;
- age rating questionnaire;
- privacy/data collection disclosures;
- review contact details.

## Sign-In Review

If login is required to access significant functionality, provide Apple
reviewers a usable review path/account where required.

Vendor approval should not prevent reviewers from seeing the core app.

## Sign in with Apple

Before release, verify whether the final combination of third-party
login options triggers Apple's current Sign in with Apple requirements.

Do not assume based on old rules.

## Permissions

Usage descriptions must truthfully explain:

- camera;
- photo library;
- any other requested permission.

## Payments

Verify Apple's current rules for the exact goods/services sold.

## Review Risks

Avoid:

- broken links;
- placeholder screens presented as finished;
- login dead ends;
- inaccessible test accounts;
- crashes;
- misleading privacy declarations;
- web-wrapper behavior masquerading as native value.

---

# 44. Google Play Preparation

Requirements change over time; verify current Play requirements
immediately before submission.

## Developer Account

- Google Play Console account.
- Prefer business/client ownership for long-term control.

## App Identity

Choose application ID aligned with Apple where practical:

```text
com.crownsourceglobal.app
```

Changing this after release effectively creates a different app.

## Store Listing

Prepare:

- app name;
- short description;
- full description;
- app icon;
- feature graphic;
- phone screenshots;
- support contact;
- privacy policy URL;
- category.

## Policy / Data

Complete:

- Data Safety form;
- content rating;
- ads declaration if applicable;
- target audience;
- app access/reviewer instructions;
- permissions declarations where required.

## Testing Tracks

Use Play testing tracks before production:

- internal;
- closed/open as appropriate;
- production.

Account-specific testing requirements should be checked for the actual
developer account at submission time.

## Payments

Verify current Google Play payment policy against physical
goods/services and any future digital features.

---

# 45. Ownership and Handover

The client/business should ultimately control critical production assets
where practical:

- Apple Developer account;
- Google Play Console;
- domain;
- Railway/hosting;
- production database ownership/access;
- R2/storage;
- Paystack business account;
- SMS provider;
- production OAuth project/credentials;
- analytics/crash reporting project.

Developer access should be granted through team/member permissions
rather than making the developer's personal account the permanent
business owner.

Document recovery contacts and credential ownership before final
handover.

---

# 46. App Store Release Strategy

Do not submit immediately after the first successful build.

Recommended sequence:

```text
Local development
      ↓
Real-device development testing
      ↓
Preview/internal build
      ↓
Client acceptance
      ↓
Production backend readiness
      ↓
TestFlight / Play internal testing
      ↓
Fix device/store issues
      ↓
Store submission
      ↓
Review
      ↓
Release
```

iOS and Android do not have to launch on the exact same day if store
review timing differs.

---

# 47. Mobile Milestone Plan

Milestone numbering may be adjusted against the final web milestone
number, but the sequence should remain deliberate.

## M17.2 --- Shared Phone OTP Authentication

Status: blocked only on production SMS-provider access/approval;
planning can continue.

Deliver:

- Better Auth phone plugin/integration.
- phone normalization;
- OTP UI;
- SMS provider adapter;
- abuse protection;
- linking rules;
- web verification;
- API/mobile compatibility considerations.

Do not implement against fake production credentials.

---

## M18 --- Mobile/API Architecture Foundation

Status: `/api/v1` namespace, response/error conventions, and the
authentication/session strategy (Better Auth `bearer()` plugin) shipped in
M18.1. M20.1 (backend-only) audited native/Expo compatibility and bumped
Better Auth 1.6.29 → 1.6.30 — the last non-breaking patch before 1.7.0's
required `Account.issuer` schema migration — so a matching
`@better-auth/expo@1.6.30` can be installed here and in the Expo app without
touching production Account/Session rows. See
`docs/architecture/overview.md`'s "Mobile API Foundation" section for the
full audit. Remaining for M18/M19: Expo repository scaffold, build profiles,
network client, secure session persistence, deep-link foundation, and
actually installing `@better-auth/expo` (client side in the mobile repo,
`expo()` server plugin here).

Deliver:

- audit existing services/actions/API routes;
- define mobile API namespace;
- API response/error conventions;
- authentication/session strategy;
- authorization matrix;
- mobile environment strategy;
- Expo repository scaffold;
- build profiles;
- base design tokens;
- network client;
- secure session persistence;
- deep-link foundation.

No feature explosion.

---

## M19 --- Mobile Shell + Identity + Mode Architecture

Deliver:

- splash/startup;
- authentication;
- session restore;
- first-use onboarding;
- Shop/Source/Sell/Both intent;
- Customer navigation;
- Vendor capability detection;
- Shopping/Business switch;
- pending Vendor state;
- account/sign-out.

---

## M20 --- Customer Catalogue & Commerce Discovery

Deliver:

- Home;
- categories;
- Shop;
- search;
- product detail;
- Vendor storefront;
- initial cart;
- responsive/native loading and error states.

---

## M21 --- Explore + Saved (implemented — delivered ahead of M22 Vendor Business Core)

**Status: implemented.** Delivered ahead of the sequence below because it was
prioritized by the client as a real beauty-discovery platform milestone. See
§12A for the full architecture. Publisher identity for M21 is an approved
Vendor (no dedicated beauty-professional/service-profile domain exists yet —
see §12A's "Publisher identity" discussion for why, and how a future
dedicated provider profile can be added without dropping `ExplorePost`).
Vendor mobile listing/fulfilment flows (the M22 content below) remain
undelivered; a Vendor's Explore-post moderation status is visible from the
web Vendor Portal (`/vendor/portal/explore`), not yet from a native Business
Home.

---

## M22 --- Vendor Business Core (renumbered from the original M21 — not yet implemented)

Deliver:

- Vendor onboarding;
- application status;
- Business Home;
- listings;
- create/edit listing;
- native product images;
- moderation status;
- orders;
- sequential fulfilment;
- basic store settings.

Admin remains web.

---

## M22.1 --- Explore + Saved (original scope, now implemented as M21 above)

Deliver:

- Explore backend contract;
- Explore feed;
- approved marketplace content;
- Saved backend;
- Save actions across Explore/Shop/Product;
- Saved account screen.

Do not build comments/followers/reels.

**Scope note (M21 delivery vs. this original text):** M21 implemented real
provider-posted portfolio content (`ExplorePost`), not "approved marketplace
content" (the M18.2 `/api/v1/explore` product-discovery endpoint, which
already existed and is untouched/separate — see §12A). Save is implemented
for Explore posts only, not yet for Shop/Product listings — that remains a
future addition using the same `ExplorePostSave`-style pattern against
`VendorListing` instead. "Saved account screen" was delivered as a
dedicated Explore-scoped `/explore/saved` screen (reachable from Explore's
header bookmark icon), not a general cross-domain Account → Saved area.

---

## M23 --- Checkout + Payments + Customer Orders

Deliver:

- delivery;
- checkout;
- Paystack;
- server verification;
- payment return/deep link;
- orders;
- order detail;
- fulfilment visibility;
- resolution entry points where appropriate.

**Scope note (delivered as the real M25, not M23):** the actual build
sequence renumbered milestones (see the real M19-M25 list at the top of
this file / §18A) — Careers/Talent shipped as the real M23, and this
slot's content (delivery, checkout, Paystack, server verification, orders)
shipped as the real **M25**, documented in full at §18A. "Payment
return/deep link" was deliberately NOT built as a deep link — see §18A.4
for why an independent status poll after the in-app browser closes was
chosen instead. "Fulfilment visibility" and "resolution entry points"
remain undelivered (M26 scope, per §18A.8).

---

## M24 --- Custom Sourcing + Quotations

Deliver:

- native sourcing request;
- camera/photo library;
- sourcing tracking;
- quotation list/detail;
- quotation PDF;
- quotation-to-checkout.

---

## M25 --- Notifications + Deep Links

Deliver:

- in-app notification center;
- device push token management;
- push delivery for selected high-value events;
- universal/app links;
- notification-to-screen routing;
- preference enforcement.

**Scope note (this slot's content not yet delivered under this number):**
the real milestone numbered M25 delivered Cart/Checkout/Paystack instead
(this old roadmap's M23 slot — see the scope note there and §18A). Nothing
in this entry (notification center, push tokens, push delivery, universal
links, preference enforcement) has been built; it remains future work
under whatever milestone number picks it up next.

---

## M26 --- Vendor Finance & Operational Polish

Deliver/finalize:

- earnings;
- adjustments where appropriate;
- settlements;
- payout destinations;
- Vendor messages/resolutions;
- Business Home attention model;
- production operational polish.

Some of this may move earlier if required by Vendor V1 acceptance.

---

## M27 --- Store Readiness

Deliver:

- real-device regression;
- production environment;
- privacy policy alignment;
- permissions audit;
- icons/splash assets;
- screenshots;
- App Store metadata;
- Play listing;
- TestFlight;
- Play internal/closed testing;
- reviewer access;
- release candidates;
- submission.

---

# 48. Features Explicitly Deferred Beyond Mobile V1

Unless client scope changes in writing:

- separate Vendor application;
- native Admin application;
- full offline mode;
- comments/social network;
- following/follower graph;
- TikTok/Reels clone;
- complex ML recommendation engine;
- Google Lens integration;
- public creator profiles/social posting;
- loyalty/rewards;
- leaderboards;
- advanced verification badges;
- sophisticated services booking calendar;
- payroll;
- background location tracking;
- live courier tracking;
- advanced factory/manufacturer portal;
- separate international logistics engine.

These can become later milestones based on actual business traction.

---

# 49. Beauty Services Future Direction

When implemented, Services should be a shared backend domain available
to mobile and web.

Do not force services into the physical-product model.

Potential flow:

```text
Customer Explore
      ↓
Beauty Provider
      ↓
Portfolio
      ↓
Service
      ↓
Date/request
      ↓
Provider confirmation
      ↓
Appointment/status
```

Vendor/provider may offer both products and services.

This is a strong future mobile feature because discovery, portfolios and
booking are naturally mobile-friendly.

---

# 50. Non-Negotiable Engineering Rules

1.  **One backend source of truth.**
2.  **No duplicate mobile business layer.**
3.  **Admin remains web for V1.**
4.  **One mobile app for Customer + Vendor.**
5.  **A user can be both Customer and Vendor.**
6.  **Backend authorization, never UI-only authorization.**
7.  **Mobile API handlers reuse existing services.**
8.  **No secrets in mobile bundle.**
9.  **Server verifies payments.**
10. **Admin moderation remains authoritative.**
11. **Mobile must not bypass existing state machines.**
12. **Do not restructure the whole web repo merely to begin mobile.**
13. **Test on real devices early.**
14. **Do not add infrastructure without a demonstrated need.**
15. **Store policies must be re-verified at submission time because they
    change.**
16. **Client/business should own production store/provider accounts.**

---

# 51. Key Product Decisions Locked by This Plan

Decision V1 Direction

---

Mobile technology React Native + Expo + TypeScript
Number of apps One Customer + Vendor app
Admin Web-only
Backend Existing CrownSource backend
Database Existing shared PostgreSQL
Business logic Shared existing services
Mobile integration Explicit authenticated/versioned APIs
Identity authority Better Auth
Phone auth Better Auth OTP + external SMS delivery
Preferred SMS Hubtel, pending API approval
Firebase Auth Not preferred as second identity authority
Customer nav Home / Explore / Shop / Source / Account
Vendor experience Business mode inside same app
Explore V1 visual marketplace discovery
Engagement Saved first; social features later
Payments Paystack, server-authoritative
Images Existing R2 architecture through safe backend paths
Push Expo-compatible push architecture
Offline Graceful network handling; no full sync engine
Services Later dedicated domain
PWA Continues to coexist with native mobile
Web Continues in production
Mobile repo Separate initially
Monorepo Only later if justified
Store ownership Prefer CrownSourceGlobal/client-owned accounts

---

# 52. Definition of Mobile V1 Success

Mobile V1 succeeds when CrownSourceGlobal has a real native iOS/Android
application in which:

### Customer

A user can:

1.  install CrownSourceGlobal;
2.  authenticate;
3.  browse Home/Explore/Shop;
4.  inspect Vendors/products;
5.  save products;
6.  add products to cart;
7.  checkout and pay safely;
8.  track orders;
9.  submit custom sourcing requests with photos;
10. receive/view quotations;
11. interact with relevant notifications;
12. manage their account.

### Vendor

The same user/app can:

1.  choose to sell;
2.  complete Vendor onboarding;
3.  wait for Admin web approval;
4.  enter Business mode once approved;
5.  create/edit listings with phone photos;
6.  submit listings for Admin review;
7.  see moderation results;
8.  receive/manage orders;
9.  perform permitted fulfilment actions;
10. view relevant finance/settlement information;
11. receive operational notifications.

### Admin

The existing Admin web application can:

1.  review Vendor applications;
2.  review listing images/details;
3.  approve/reject/request changes;
4.  manage sourcing/quotations;
5.  manage orders/resolutions/finance;
6.  affect the exact same records seen by mobile users.

There is no duplicate database and no manual synchronization.

---

# 53. Immediate Next Steps

The correct sequence from the current project state is:

1.  **Do not start a broad mobile rewrite yet.**
2.  Follow up with Hubtel regarding API-key/developer access.
3.  Complete M17.2 Phone OTP when a production-capable SMS route is
    available.
4.  Freeze/record the final web/backend production baseline.
5.  Audit existing backend services and actions specifically for mobile
    exposure.
6.  Start M18 Mobile/API Architecture Foundation.
7.  Scaffold the Expo application only after auth/API boundaries are
    understood.
8.  Build Customer and Vendor flows vertically against real shared
    backend behavior.
9.  Introduce Explore + Saved as controlled shared-backend features.
10. Test real devices throughout development.
11. Create preview builds for client acceptance.
12. Prepare production/store accounts and compliance before final
    submission.

---

# 54. Final Architecture Principle

The mobile project should never become:

> "Build CrownSourceGlobal again in React Native."

It should be:

> **"Give the existing CrownSourceGlobal platform a first-class native
> Customer and Vendor interface, while preserving one backend, one set
> of business rules, one database, and one operational truth."**

That principle should guide every implementation decision made after
this document.

---

# 55. M27 — Native Vendor Experience (Implemented)

One mobile app. No separate Vendor app, no second authentication system.
A `User` may hold a `CustomerProfile`, an approved `VendorMembership`
(role `OWNER`/`STAFF`), or both — same session throughout. `GET
/api/v1/me` already carried `vendor.available`/`vendor.memberships`/
`vendorApplication` (M18.1); M27 wires that data into an actual entry
point instead of just displaying it.

**Role model / Account.** `(tabs)/account.tsx` is the role-switching
surface: no vendor capability and no application → "Start selling"; an
in-flight application → tap-through to its live status; `vendor.available`
→ an "Enter Vendor Mode" button. `requireVendorPortalContext`'s existing
"first membership only" limitation (no multi-vendor switcher) applies to
mobile too — `resolveVendorContext` (`lib/api/vendor-context.ts`) mirrors
it exactly, non-redirecting, for every `/api/v1/vendor/*` route.

**Onboarding.** `src/app/vendor-onboarding/index.tsx` — one mobile-
appropriate multi-step screen (seller type → contact → business →
what-you-sell → review) over the exact same persisted `VendorApplication`
draft and per-step save/validate/submit behavior the web wizard uses
(`/api/v1/vendor-application*`, mirroring `lib/actions/vendor-application.ts`
field-for-field). Honest states only: `DRAFT`/`SUBMITTED`/`UNDER_REVIEW`/
`CHANGES_REQUESTED`/`APPROVED`/`REJECTED`, editable only in
`EDITABLE_STATUSES`, `decisionReason` shown verbatim when present.

**Vendor Mode shell.** `src/app/(vendor)/_layout.tsx` — a Tabs navigator
(Dashboard / Listings / Orders / Finance / More) distinct from the
customer TabBar, gated by `useVendorModeGuard` (a UI-affordance check
only — every `/api/v1/vendor/*` route re-verifies membership server-side).
Detail screens are flat top-level `vendor-*` routes in the root Stack
(`vendor-listings/[id]`, `vendor-orders/[id]`, `vendor-finance/**`,
`vendor-store`, `vendor-beauty-professional/**`, `vendor-explore-posts`) —
not nested inside the tab group, so pushing/popping into Vendor Mode
detail screens works exactly like the rest of the app. "More" → "Switch to
shopping" returns to `(tabs)/account` — same User, same session, no
re-auth.

**Listings.** List/detail/create/edit against `vendorListingsService`
unchanged. The M21.2 invariant (`pendingChanges` staged on an edit to a
live `APPROVED`+`ACTIVE` listing; the public row stays untouched pending
re-review) is surfaced explicitly in the UI as a "LIVE, pending changes"
notice. Images: gallery picker → `prepareImage` (resize/recompress,
proven M23.4/M24 pipeline) → `expo-file-system` `File` → `FormData` →
`PATCH /api/v1/vendor/listings/:id` — never `{ uri, name, type }`, never a
pasted URL. `VendorListingDetailDTO.images` is `{ key, url }[]`, not a
resolved-URL array — the edit form needs the raw storage key back
verbatim as `existingImages` on save (an image is "removed" by omitting
its key); this shape was a real bug caught and fixed during
implementation. Inventory (`availableQuantity`/`availabilityStatus`) is
its own always-editable action, independent of moderation status. Bulk
price tiers round-trip through the same save call; there is no mobile
bulk-tier editor UI yet (deferred — see below).

**Orders / fulfilment.** Vendor mutation surface is exactly the four
methods `fulfilmentService` already exposed: `startPreparing`
(PENDING→PREPARING), `markReady` (PREPARING→READY),
`recordVendorShipment` (READY→DISPATCHED, `INTERNATIONAL_INBOUND` only),
`reportIssue`. The order detail screen renders only the single next valid
action for the fulfilment's current status/origin — never multiple status
buttons at once, and the backend independently enforces the same
`fromStatuses` allowlist regardless of what the UI shows. Domestic
collection, transit, delivery remain admin/logistics-driven, exactly as
on web.

**Multi-vendor privacy.** Every `/api/v1/vendor/*` service call passes
`resolveVendorContext(...).vendorId` — never a client-supplied vendor id
— into an already vendor-scoped repository query (`findDetailForVendor`,
`findForVendor`, etc.), so a fulfilment/listing belonging to another
vendor resolves as 404, never 403 (no enumeration signal). Verified for
every one of the 33 new routes by direct grep audit, and covered by three
new integration test files exercising real cross-vendor requests against
the dev database: `app/api/v1/vendor/orders/[id]/route.test.ts`,
`app/api/v1/vendor/listings/[id]/route.test.ts`, and OWNER-only
enforcement in `app/api/v1/vendor/finance/payout-destination/route.test.ts`.

**Earnings / payout.** Read-only `VendorEarning`/`VendorSettlement`
summaries and detail, real backend values only. Payout destination is
display (masked — `momoPhoneMasked`/`bankAccountNumberMasked`, never a
full number) + OWNER-only edit
(`vendorFinanceService.upsertPayoutDestinationForVendor` already enforces
this — the route only passes the caller's real membership role through).
**No "Withdraw" action exists anywhere in mobile** — automated Paystack
vendor payouts remain on manual fallback (Starter Business tier, per
`docs/deployment/railway.md`); this was verified against current backend
truth, not assumed.

**Beauty Professional / Explore.** Profile (create/edit, real photo
upload only), offered services (add/edit/show-hide), and the
CrownSourceGlobal-mediated service-request queue (accept/decline) are new
— `beautyProfessionalsService`/`beautyServicesService`/
`serviceRequestsService` were already vendor-scoped with no
customer/provider contact-detail leakage; M27 only added thin route
wrappers. `serviceRequestsService.listForProfessional` is keyed by
`BeautyProfessionalProfile.id`, not `vendorId` — every new route resolves
that via `getForVendor(vendorId)` first, same as the web portal page.
Explore's vendor-management API (`mine`/create/edit/archive) already
existed in full from M21 — mobile's "My Explore posts" screen
(`vendor-explore-posts.tsx`) reuses `useMyExplorePosts` and the existing
`explore/create.tsx` creation flow unchanged; it adds archive but not a
new edit UI (deferred — see below). No direct customer/provider chat or
contact-detail exposure was added anywhere in this milestone.

**Deferred out of this pass** (none of these change any business rule —
just not built yet):

- A dedicated mobile Explore-post edit screen (`PATCH
  /api/v1/explore-posts/[id]` already exists and works; only the mobile
  UI to drive it is missing — "archive" is the only mutation mobile
  exposes today).
- A mobile bulk-price-tier editor (tiers persist through listing saves,
  but there's no UI to add/remove a tier yet).
- A `specs` (key/value spec sheet) editor for listings.
- A multi-vendor-membership switcher — matches the web Vendor Portal's
  own current "first membership only" limitation exactly; not a
  regression introduced here.
- Native push notifications (M28's scope per the existing plan).

**Admin remains web-only** — nothing in this milestone added a mobile
admin surface, and no admin-only action became reachable from a
`VendorMembership` alone.
