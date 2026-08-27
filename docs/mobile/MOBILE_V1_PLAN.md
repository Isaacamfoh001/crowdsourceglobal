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

## M21 --- Vendor Business Core

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

## M22 --- Explore + Saved

Deliver:

- Explore backend contract;
- Explore feed;
- approved marketplace content;
- Saved backend;
- Save actions across Explore/Shop/Product;
- Saved account screen.

Do not build comments/followers/reels.

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
