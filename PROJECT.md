# CrownSourceGlobal — Project Brief

## 1. Project Overview

CrownSourceGlobal is a **managed commerce marketplace and sourcing platform** connecting customers with approved vendors.

The platform should combine the simplicity and familiarity of modern e-commerce with the capabilities required for bulk purchasing and custom procurement.

A customer should be able to:

1. browse products and purchase normally;
2. purchase larger quantities using predefined bulk/wholesale pricing and receive an instant quotation;
3. request a custom quotation when the required product, quantity, specification, or sourcing requirement cannot be handled automatically.

CrownSourceGlobal sits between customers and vendors and manages the commercial relationship.

The platform is **commerce-first**, not RFQ-first.

Normal purchases should feel like shopping on a modern e-commerce platform. Procurement-style workflows should only appear where the customer's requirements genuinely require them.

---

# 2. Product Vision

CrownSourceGlobal should make purchasing and selling significantly easier for both sides of the marketplace.

For customers, the platform should remove problems such as:

- searching across many suppliers;
- contacting multiple vendors;
- waiting for individual vendor responses;
- negotiating separately with multiple suppliers;
- dealing with uncertain supplier credibility;
- coordinating different suppliers;
- fragmented payment processes;
- difficulty obtaining bulk pricing;
- difficulty sourcing unusual or specialized requirements;
- poor visibility into order progress.

For vendors, the platform should reduce the operational burden of selling.

Vendors should primarily focus on:

> **List products → maintain availability → fulfil confirmed requests → get paid.**

CrownSourceGlobal should handle much of the commercial complexity between those steps.

This includes:

- marketplace/customer acquisition;
- buyer communication;
- quotations;
- payments;
- order coordination;
- customer support;
- marketplace administration;
- transaction records;
- coordination around fulfilment.

A central vendor proposition is:

> **You supply. We handle the rest.**

---

# 3. Core Marketplace Relationship

CrownSourceGlobal is not intended to operate primarily as a direct buyer-to-vendor marketplace.

The relationship should conceptually be:

Customer

↓

CrownSourceGlobal

↓

Vendor

rather than:

Customer ↔ Vendor

CrownSourceGlobal owns and manages the customer-facing commercial relationship.

---

# 4. Customer Definition

A customer/buyer does not have to be a registered company.

Customers may include:

- individuals;
- entrepreneurs;
- small businesses;
- large businesses;
- procurement professionals;
- institutions;
- organizations;
- NGOs;
- schools;
- government-related organizations;
- other legitimate purchasers.

The UX must therefore not assume that every customer understands procurement terminology or has an organizational procurement department.

The shopping experience should remain understandable to an ordinary consumer.

Business/company functionality may be introduced where appropriate without making it a requirement for ordinary purchasing.

---

# 5. Primary User Groups

The platform has four major experiences.

## 5.1 Public Experience

The public website serves both as:

- a marketplace;
- a product discovery experience;
- a marketing website;
- a customer acquisition channel;
- a vendor acquisition channel.

Visitors should be able to understand CrownSourceGlobal before creating an account.

---

## 5.2 Customer Experience

Customers browse, purchase, obtain quotations, request custom sourcing, pay, track orders, receive documents, communicate with CrownSourceGlobal, and manage their accounts.

---

## 5.3 Vendor Experience

Vendors manage their marketplace presence, products, availability/inventory where applicable, assigned fulfilments, payouts, notifications, and company information.

---

## 5.4 CrownSourceGlobal Admin Experience

Administrators operate the marketplace and coordinate the commercial and operational processes behind the customer experience.

Operational complexity should generally live here rather than being exposed unnecessarily to customers.

---

# 6. Public Website / Landing Page

The public landing page is an important part of the product.

It must clearly communicate the problems CrownSourceGlobal solves for both customers and vendors.

It should not look like an enterprise procurement dashboard.

It should feel like a trustworthy, modern commerce marketplace.

---

## 6.1 Primary Customer Message

Customers should quickly understand:

> Buy what you need, however you need it.

CrownSourceGlobal supports:

- individual purchases;
- ordinary shopping;
- business purchases;
- bulk purchases;
- wholesale pricing;
- instant quotations;
- custom sourcing.

Potential primary CTAs include:

- Shop Products
- Browse Categories
- Get Bulk Pricing
- Request Custom Quote

"Shop Products" should generally be the most obvious commerce CTA.

The website must not accidentally imply that every purchase requires a quotation.

---

# 7. Landing Page Buyer Story

The website should explain three simple ways to buy.

## Shop Normally

Browse products, add items to cart, checkout, pay, and track the order like a normal e-commerce experience.

## Buy in Bulk

Select larger quantities and automatically receive applicable bulk/wholesale pricing.

Where pricing is predefined, customers should be able to generate an instant quotation without waiting for a human.

## Custom Sourcing

If the customer cannot find the required product or has unusual specifications, quantities, branding, delivery requirements, or other needs, they can submit a custom sourcing request.

CrownSourceGlobal handles the sourcing process and returns a quotation.

---

# 8. Landing Page Vendor Story

Vendor acquisition should be a prominent part of the public website.

The website should communicate that vendors do not need to manage the entire customer-commerce process themselves.

The central proposition is:

> **You supply. We handle the rest.**

The vendor journey should feel approximately like:

1. Join CrownSourceGlobal.
2. Complete vendor/company profile.
3. List products.
4. Maintain accurate product and availability information.
5. Receive confirmed fulfilment opportunities/orders.
6. Fulfil them.
7. Receive payout.

CrownSourceGlobal handles customer-facing activities such as:

- marketplace discovery;
- buyer communication;
- customer support;
- quotations;
- collection of customer payments;
- order coordination;
- transaction management.

A strong public CTA should encourage suppliers to:

> **Become a Vendor**

---

# 9. Trust

Trust is fundamental because CrownSourceGlobal sits between customers and vendors.

The public experience should communicate concepts such as:

- approved/verified vendors;
- centralized transactions;
- managed customer support;
- transparent pricing and quotations;
- order visibility;
- managed fulfilment;
- reliable sourcing.

Exact marketing claims must only be displayed when they are factually supportable.

---

# 10. Public Product Discovery

The landing page should transition naturally into the marketplace.

Potential sections include:

- Featured Products
- Popular Categories
- Featured Vendors
- Recently Added Products
- Bulk Deals
- How It Works
- Custom Sourcing
- For Vendors
- Why CrownSourceGlobal

The transition should feel like:

Landing Page

↓

Discovery

↓

Catalogue

↓

Product

↓

Purchase

rather than having a disconnected marketing website and marketplace.

---

# 11. Public Navigation

The final information architecture should be determined during UX planning, but likely public areas include:

- Home
- Shop
- Categories
- Bulk Orders / Bulk Buying
- Custom Sourcing
- For Vendors
- How It Works
- About
- Careers
- Contact
- Search
- Sign In
- Register
- Cart

Do not treat this list as a mandatory final navigation structure. Optimize it during UX design.

---

# 12. Catalogue

The platform should contain a browsable product catalogue.

Products should support information such as:

- name;
- description;
- category;
- vendor;
- images;
- SKU/reference where appropriate;
- specifications;
- availability;
- pricing;
- bulk pricing;
- minimum quantities where relevant;
- status;
- approval status.

Customers should be able to:

- browse;
- search;
- filter;
- sort;
- browse categories;
- view product details;
- view vendor storefronts;
- select quantities;
- add products to cart;
- buy products.

The exact search implementation should be decided during architecture planning.

---

# 13. Categories

Products should be organized into meaningful categories and potentially subcategories.

Example:

Electronics

- Computers
  - Laptops
  - Desktops
  - Accessories

- Televisions
- Networking

Office

- Furniture
- Equipment
- Stationery

The category system should support expansion without requiring architectural changes.

---

# 14. Vendor Storefronts

Approved vendors should be able to have marketplace storefronts.

A storefront may contain:

- vendor name;
- logo;
- description;
- verification/approval information where appropriate;
- categories;
- products;
- marketplace information.

Customers may browse products by vendor.

However, vendor storefronts must not create a direct customer-vendor communication channel.

---

# 15. Communication Model

Customers must not communicate directly with vendors through the platform.

All customer-facing communication should go through CrownSourceGlobal.

Conceptually:

Customer ↔ CrownSourceGlobal

CrownSourceGlobal ↔ Vendor

not:

Customer ↔ Vendor

If a customer clicks something such as:

- Ask a Question
- Contact About Product
- Get Help
- Ask About This Store

the resulting conversation should be with CrownSourceGlobal.

The system should retain context about what triggered the conversation.

Examples:

- product;
- vendor storefront;
- order;
- quotation;
- custom sourcing request;
- general enquiry.

Example internal context:

Vendor: ABC Technologies
Product: Dell Latitude 5550
Product ID: PRD-123

Customer-facing communication remains with CrownSourceGlobal.

---

# 16. Purchase Path A — Standard Purchase

Ordinary purchases should follow familiar e-commerce UX.

Customer:

Browse/Search

↓

Product

↓

Select quantity

↓

Add to Cart / Buy Now

↓

Cart

↓

Checkout

↓

Payment to CrownSourceGlobal

↓

Order Confirmation

↓

Fulfilment

↓

Delivery

Customers should not encounter procurement terminology during ordinary purchases.

---

# 17. Cart

Customers should be able to add products to a shopping cart.

The cart may eventually contain products supplied by multiple vendors.

The customer should still experience a unified CrownSourceGlobal checkout where commercially and technically appropriate.

Internally, the system must preserve vendor relationships for fulfilment and payout.

---

# 18. Purchase Path B — Bulk Purchase / Instant Quotation

Products may have quantity-based pricing tiers.

Example:

1–4 units → GH₵1,000/unit
5–19 units → GH₵950/unit
20–49 units → GH₵900/unit
50+ units → GH₵850/unit

Exact pricing structures may differ by product.

When sufficient pricing information already exists, a customer requesting a large quantity should not need to wait for manual administrative review.

The experience should approximately be:

Product

↓

Select quantity

↓

System determines applicable bulk price

↓

Customer requests/views instant quotation

↓

Formal quotation generated

↓

Proceed to Checkout

↓

Payment

↓

Order

The quotation may contain:

- quotation reference;
- customer information where appropriate;
- products;
- quantities;
- unit prices;
- subtotal;
- taxes;
- fees where applicable;
- delivery;
- total;
- currency;
- validity period;
- terms where applicable.

The customer should be able to proceed from an eligible quotation directly into checkout.

---

# 19. Pricing

The architecture should support flexible pricing.

Potential concepts include:

- retail/customer price;
- quantity-based pricing;
- vendor supply price;
- CrownSourceGlobal margin;
- promotional pricing;
- custom quotation pricing.

The exact pricing model must be carefully designed before implementation.

The platform should not assume that vendor cost must be exposed to customers.

Similarly, CrownSourceGlobal's final customer pricing need not necessarily expose internal margin calculations to vendors.

Financial visibility should follow explicit business rules.

---

# 20. Purchase Path C — Custom Sourcing

Custom sourcing exists for requirements that cannot reasonably be handled through ordinary catalogue purchasing or predefined bulk pricing.

Examples:

- item not in catalogue;
- unusual quantities;
- custom specifications;
- branded products;
- complex delivery requirements;
- specialized industrial equipment;
- multi-item procurement requirements;
- requests requiring vendor negotiation.

The customer experience should use understandable terminology such as:

> Request Custom Quote

rather than forcing ordinary users to understand "RFQ."

The process should approximately be:

Customer submits requirement

↓

CrownSourceGlobal reviews

↓

CrownSourceGlobal sources suitable vendors

↓

Pricing/availability established

↓

CrownSourceGlobal prepares quotation

↓

Customer receives quotation

↓

Customer accepts

↓

Checkout

↓

Payment

↓

Order

The internal sourcing process may be more sophisticated than what is exposed to customers.

---

# 21. Custom Sourcing Request

A custom sourcing request may include:

- title;
- description;
- category;
- quantity;
- specifications;
- desired delivery date;
- delivery location;
- attachments;
- images/documents;
- notes;
- contact information.

Exact required fields should be determined during UX/domain design.

---

# 22. Orders

After successful checkout/payment according to the final payment model, an order should represent the customer's purchase.

Customer-facing order information may include:

- order number;
- items;
- quantities;
- pricing;
- payment status;
- order status;
- delivery information;
- tracking/progress;
- relevant documents;
- support/messaging context.

The customer should see CrownSourceGlobal as the party managing the order.

---

# 23. Orders and Vendor Fulfilments Are Different Concepts

The customer has an **Order**.

Vendors receive **Fulfilments**.

An order may potentially contain items supplied by multiple vendors.

Example:

Order #1002

- Laptops → Vendor A
- Office Chairs → Vendor B
- Projectors → Vendor C

Internally this may produce:

Order

├── Fulfilment A → Vendor A
├── Fulfilment B → Vendor B
└── Fulfilment C → Vendor C

The customer should not have to manage those vendor relationships.

CrownSourceGlobal coordinates the overall order.

This distinction is important and should be preserved in domain modeling.

---

# 24. Fulfilment

Vendors should receive only the information necessary to fulfil assigned products/orders.

Potential fulfilment states may include:

- pending;
- accepted;
- preparing;
- ready;
- shipped/dispatched;
- delivered;
- completed;
- cancelled;
- exception/disputed.

These are conceptual only. Final states should be designed during domain planning rather than assumed from this document.

The system should support partial/multi-vendor fulfilment where necessary.

---

# 25. Payments

Customers pay CrownSourceGlobal, not vendors directly through the marketplace.

Conceptually:

Customer

↓

Payment to CrownSourceGlobal

↓

Order processing / fulfilment

↓

Vendor payout according to business rules

The payment architecture must consider:

- payment confirmation;
- payment provider integration;
- failed payments;
- retries;
- duplicate callbacks/webhooks;
- refunds;
- cancellations;
- payment references;
- reconciliation;
- auditability;
- vendor payouts;
- CrownSourceGlobal margin/fees;
- security.

Because marketplace payments and holding/distributing funds can have legal, regulatory, accounting, tax, and payment-provider implications, do not assume a specific escrow or custodial model without explicit confirmation.

Technical architecture should allow the final commercial/payment arrangement to be implemented safely.

---

# 26. Vendor Payouts

Vendors should have visibility into money owed and paid to them according to CrownSourceGlobal's business rules.

Potential information includes:

- fulfilment;
- order reference;
- payable amount;
- payout status;
- expected payout;
- payout date;
- transaction reference.

Vendor payout should remain distinct from customer payment.

---

# 27. Vendor Product Management

Vendors should be able to:

- add products;
- edit products;
- upload product images;
- set relevant product information;
- maintain availability/inventory where applicable;
- manage pricing information they are authorized to control;
- view product status.

CrownSourceGlobal should retain marketplace moderation capabilities.

---

# 28. Product Approval

Vendor-created products may require administrative approval before becoming publicly visible.

Conceptually:

Vendor creates product

↓

Pending Review

↓

Admin review

↓

Approved / Changes Requested / Rejected

↓

Public marketplace if approved

The exact moderation workflow should be determined during domain planning.

The architecture should allow trusted-vendor rules or future workflow changes without major redesign.

---

# 29. Vendor Portal

The vendor portal should prioritize simplicity.

Potential primary areas:

## Dashboard

Useful information such as:

- active products;
- pending product reviews;
- new fulfilments;
- fulfilments requiring action;
- completed fulfilments;
- pending payouts;
- recent activity.

## Products

- all products;
- add product;
- edit product;
- approval status;
- inventory/availability.

## Fulfilments

- new;
- accepted;
- processing;
- dispatched;
- completed;
- exceptions.

## Payouts

- pending;
- processing;
- paid;
- payout history.

## Notifications

Important vendor events.

## Company Profile

Vendor information and verification-related data.

## Settings

Account and relevant company settings.

The final IA should be determined during UX design.

---

# 30. Customer Account

The customer account should remain easy to understand.

Potential areas:

- Dashboard / Account Overview
- Orders
- Quotes
- Custom Requests
- Messages
- Invoices / Receipts
- Notifications
- Profile
- Addresses
- Business Information where applicable
- Settings

Customers should not be exposed to internal CrownSourceGlobal operational concepts unnecessarily.

---

# 31. Admin Platform

The admin platform contains much of the operational complexity.

Potential areas include:

- Dashboard
- Customers
- Vendors
- Vendor Verification
- Products
- Product Approvals
- Categories
- Orders
- Fulfilments
- Quotes
- Custom Sourcing Requests
- Sourcing
- Payments
- Refunds
- Invoices
- Vendor Payouts
- Messages
- Notifications
- Analytics / Reporting
- Careers where applicable
- Platform Settings

The exact information architecture should be designed rather than assumed.

---

# 32. Admin Responsibilities

Administrators may need to:

- approve vendors;
- manage customers;
- approve/moderate products;
- manage categories;
- handle custom sourcing requests;
- communicate with customers;
- communicate separately with vendors;
- prepare custom quotations;
- oversee orders;
- coordinate fulfilment;
- resolve fulfilment problems;
- verify/monitor payments;
- issue/manage invoices;
- manage refunds;
- manage vendor payouts;
- monitor marketplace activity;
- review operational analytics;
- manage platform content/settings.

Important administrative actions should be auditable.

---

# 33. Quotations

The system should distinguish between at least two conceptual quotation types.

## Instant Quotation

Generated automatically from known pricing/business rules.

Requires no manual sourcing when all required commercial information is available.

## Custom Quotation

Created as a result of a custom sourcing request and potentially administrative/vendor sourcing work.

Both should provide a clear path toward checkout/order creation when valid.

Quotation validity and immutable commercial snapshots should be considered during domain design.

---

# 34. Messaging

Messaging should be contextual.

Potential conversation contexts include:

- product;
- vendor storefront;
- quotation;
- custom request;
- order;
- delivery/fulfilment;
- general support.

Customer-facing messaging always goes to CrownSourceGlobal.

Vendor communication with CrownSourceGlobal should remain operationally separate from customer conversations unless an explicit internal workflow connects them.

Do not expose vendor contact information to customers through messaging features without an explicit product decision.

---

# 35. Notifications

The system should support important notifications.

Customer examples:

- quotation ready;
- order confirmed;
- payment update;
- order status changed;
- order dispatched;
- invoice available;
- support response.

Vendor examples:

- product approved;
- product requires changes;
- new fulfilment;
- fulfilment deadline;
- payout processed.

Admin examples:

- new custom sourcing request;
- vendor application;
- product awaiting approval;
- payment issue;
- fulfilment problem;
- payout requiring action.

Potential delivery channels include:

- in-app;
- email;
- SMS;
- WhatsApp or other channels later.

Do not assume every channel is required for the initial release.

---

# 36. Invoices and Receipts

The platform should support appropriate transaction documentation.

Potential documents include:

- quotations;
- invoices;
- receipts;
- order confirmations;
- vendor payout records.

Documents should preserve historical transaction values rather than depend on mutable current product pricing.

PDF generation may be required.

Exact accounting/tax requirements must be confirmed before implementation.

---

# 37. Search

Customers should be able to discover products efficiently.

Potential search capabilities include:

- keyword search;
- category filtering;
- vendor filtering;
- price filtering;
- availability filtering;
- sorting.

The initial architecture should choose the simplest solution that satisfies expected usage while allowing future improvement.

Do not introduce a dedicated search infrastructure unless justified.

---

# 38. Careers

The public website should include a Careers area where CrownSourceGlobal can communicate employment opportunities.

The exact recruitment workflow is not currently a core marketplace requirement.

Architecture should avoid unnecessary recruitment-system complexity unless requirements expand.

---

# 39. Authentication

The system requires authentication for protected actions.

Potential actors include:

- customer;
- vendor user;
- administrator.

A customer may be an individual or may act on behalf of a business.

Do not model all customers as organizations.

Vendor users generally represent a vendor business/company.

The architecture should allow sensible account evolution, including multiple users per organization if required in the future, without forcing unnecessary complexity into the initial customer experience.

---

# 40. Authorization

Authorization must be enforced server-side.

Examples:

- customers must not access another customer's private orders;
- vendor users must not access another vendor's private data;
- vendors must only access fulfilments assigned to them;
- vendors must not access customer conversations;
- customers must not access vendor operational information;
- only authorized administrators should access administrative functionality;
- financial operations require appropriate permissions.

Never rely solely on hidden UI elements for security.

---

# 41. Security

The platform must treat security as a first-class concern.

Important areas include:

- authentication;
- authorization;
- session security;
- input validation;
- payment integration;
- webhook verification;
- file upload security;
- secret management;
- rate limiting where appropriate;
- audit logging;
- data access boundaries;
- protection against common web vulnerabilities.

Do not expose internal secrets or unnecessary private vendor/customer data.

---

# 42. Auditability

Important commerce and administrative actions should be traceable.

Examples:

- product approval;
- quotation generation;
- quotation modification;
- payment confirmation;
- refund;
- order status changes;
- fulfilment updates;
- payout actions;
- administrative overrides.

Audit logs should record enough information for operational investigation without unnecessarily storing sensitive secrets.

---

# 43. UX Principles

The product should prioritize:

## Familiarity

Ordinary purchasing should feel like modern e-commerce.

## Simplicity

Do not expose internal procurement complexity to customers.

## Progressive Complexity

Only introduce quotation/sourcing workflows when the purchase actually requires them.

## Trust

Customers should understand who they are transacting with and what is happening to their order.

## Clear Status

Orders, quotations, fulfilments, and payouts should have understandable statuses.

## Role-Specific Experiences

Customers, vendors, and administrators have fundamentally different jobs.

Their interfaces should reflect this.

## Mobile Responsiveness

The entire customer-facing experience should work well across desktop and mobile.

Vendor/admin workflows should also be responsive where practical.

---

# 44. Design Direction

The platform should feel:

- modern;
- professional;
- trustworthy;
- premium but accessible;
- clean;
- commerce-oriented;
- easy to navigate.

Avoid making the customer-facing site feel like complicated enterprise procurement software.

Visual design decisions such as:

- typography;
- colors;
- spacing;
- components;
- imagery;
- responsive behavior;
- interaction patterns

should eventually form a coherent design system.

---

# 45. Responsive Web Application

The initial product is a responsive web application.

The architecture should not assume native mobile applications are required initially.

The system should nevertheless expose sensible boundaries that would not make future mobile clients unnecessarily difficult if the business later requires them.

---

# 46. Engineering Priorities

The technical solution should prioritize:

1. maintainability;
2. security;
3. development speed;
4. operational simplicity;
5. strong data integrity;
6. good developer experience;
7. testability;
8. reasonable scalability;
9. observability;
10. cost efficiency.

The initial engineering team is small.

Do not optimize prematurely for hypothetical massive scale at the cost of excessive complexity.

---

# 47. Architectural Philosophy

Start with the simplest architecture that properly supports the domain and production requirements.

Do not assume the project requires:

- microservices;
- Kubernetes;
- Kafka;
- Redis;
- a message broker;
- separate frontend/backend deployments;
- dedicated search infrastructure;
- complex event-driven architecture;
- multiple databases.

Any such technology may be recommended if there is a concrete reason.

Recommendations must explain:

- what problem the technology solves;
- why the current system needs it;
- simpler alternatives;
- operational cost;
- tradeoffs.

A well-structured modular monolith is acceptable and may be preferable initially if justified.

---

# 48. Architecture Decisions Still To Be Made

No final technical architecture has been selected.

Architecture planning should determine appropriate choices for:

- repository structure;
- frontend framework;
- rendering strategy;
- backend architecture;
- API strategy;
- database;
- ORM/data-access approach;
- authentication;
- authorization;
- session management;
- payment provider architecture;
- vendor payout architecture;
- product image/file storage;
- custom-request attachments;
- PDF/document generation;
- email;
- notifications;
- background processing;
- scheduled jobs;
- search;
- caching;
- audit logging;
- observability;
- error monitoring;
- analytics;
- testing;
- CI/CD;
- hosting/deployment;
- secrets;
- environment management;
- backups;
- disaster recovery;
- security controls.

Do not assume choices before evaluating requirements and tradeoffs.

---

# 49. Domain Areas

Likely domain areas include:

- Identity
- Customers
- Businesses/Organizations
- Vendors
- Vendor Verification
- Catalogue
- Categories
- Products
- Pricing
- Inventory/Availability
- Cart
- Checkout
- Instant Quotations
- Custom Sourcing
- Custom Quotations
- Orders
- Fulfilments
- Payments
- Refunds
- Vendor Payouts
- Invoices/Documents
- Messaging
- Notifications
- Administration
- Audit
- Reporting

These boundaries are conceptual and should be refined during architecture planning.

---

# 50. Important Domain Distinctions

The architecture must not accidentally collapse these concepts.

### Customer Order ≠ Vendor Fulfilment

A customer may place one order containing products from multiple vendors.

### Customer Payment ≠ Vendor Payout

The customer pays CrownSourceGlobal.

Vendor payment/payout occurs separately according to business rules.

### Instant Quote ≠ Custom Sourcing Request

Instant quotations use known pricing rules.

Custom sourcing requires human/operational intervention.

### Vendor Storefront ≠ Direct Vendor Relationship

Customers may browse vendor products without communicating or transacting directly with the vendor.

### Product Price ≠ Historical Order Price

Orders, quotations, invoices, and financial documents should preserve their commercial values even if the current product price later changes.

---

# 51. Initial Release Philosophy

The initial release should deliver the core marketplace experience without unnecessary feature expansion.

Core priorities include:

### Public Marketplace

- landing page;
- product discovery;
- categories;
- product pages;
- vendor storefronts;
- vendor acquisition.

### Commerce

- cart;
- checkout;
- standard purchasing;
- bulk pricing;
- instant quotation.

### Custom Sourcing

- custom request;
- admin processing;
- custom quotation;
- conversion to checkout/order.

### Orders

- customer order management;
- vendor fulfilment;
- order tracking.

### Marketplace Operations

- vendor onboarding;
- product management;
- product moderation;
- payments;
- vendor payouts;
- customer support.

### Communication

- customer ↔ CrownSourceGlobal messaging;
- CrownSourceGlobal ↔ vendor operational communication;
- notifications.

### Administration

- operational controls required to run the marketplace.

Features such as advanced recommendations, sophisticated forecasting, complex corporate approval chains, multi-region infrastructure, native apps, or advanced automation should not be assumed for the initial release.

---

# 52. Current Project Stage

The project is currently in:

> **Product definition, UX planning, and system architecture planning.**

Production application code has not yet been initialized.

The immediate goal is to:

1. validate the product understanding;
2. identify ambiguities;
3. design the system architecture;
4. define domain boundaries;
5. model critical workflows;
6. define the data model;
7. define authorization;
8. define API/application boundaries;
9. define the frontend architecture;
10. define infrastructure/deployment;
11. document important architectural decisions;
12. only then initialize and implement the production application.

---

# 53. Product Summary

CrownSourceGlobal is a **commerce-first managed marketplace**.

Customers can:

> **Shop normally, buy in bulk with instant pricing, or ask CrownSourceGlobal to source something custom.**

Vendors can:

> **List products, fulfil confirmed demand, and get paid while CrownSourceGlobal handles the customer-facing commercial workflow.**

CrownSourceGlobal manages the relationship between both sides:

> **Customer → CrownSourceGlobal → Vendor**

The customer experience should remain simple.

The vendor experience should remain operationally focused.

The administrative platform should absorb the complexity necessary to make those simple experiences possible.

---

# 54. Approved V1 Business/Product Clarifications

Architecture planning has resolved the following as authoritative product/business truths. These refine sections above; where they add detail not previously stated, that detail is now binding for V1.

## 54.1 Customer-Directed vs. CrownSource-Directed Multi-Vendor Purchasing

Normal marketplace shopping is customer-directed: the customer explicitly selects vendor listings and quantities (for example, 40 units from Vendor A's listing and 60 units from Vendor B's listing for a similar item). CrownSourceGlobal does not automatically split an ordinary purchase quantity across vendors — the customer's chosen line items are the only allocation that exists.

Custom sourcing is different. CrownSourceGlobal may internally allocate a customer's requested quantity across multiple vendors (for example, 600 units from Vendor A and 400 from Vendor B to fulfil a request for 1,000 units) while the customer sees a single, unified commercial quotation and order, without needing to understand or manage the internal vendor split.

## 54.2 Vendor Listing Is the Sellable Unit

There is no cross-vendor canonical "product" that multiple vendors compete to fulfil in V1. Two vendors selling similar items (for example, two vendors each listing "22-inch Human Hair" at different prices and stock levels) appear in the marketplace as independent vendor listings, not as one shared catalogue entry with multiple offers. A future feature that matches equivalent listings from different vendors into a single canonical product is a distinct, later product decision and is not assumed for V1.

## 54.3 Vendor Payout Uses Historical Economics

The amount owed to a vendor for a given transaction is fixed at the time of that transaction and does not change if the vendor's current supply price or CrownSourceGlobal's pricing rules change afterward.

## 54.4 Accepted Quotations Are Immutable Commercial Commitments

Once a customer accepts a quotation (instant or custom), its commercial terms are locked and are not re-priced at checkout, even if catalogue pricing changes before the quotation's validity period ends. Standard cart-based checkout, by contrast, reconfirms current price and availability immediately before the order is placed, since cart contents are informational rather than a commercial commitment.

## 54.5 Payment Method Requirements

Checkout must support Ghana Mobile Money and major card networks (Visa, Mastercard, and similar) as a market/product requirement, not merely a technical implementation detail.

## 54.6 Authentication Requirements

Customer authentication must support both:

- email/password, including registration, email verification, and password reset; and
- "Continue with Google" sign-in.

Google sign-in must be presented as a prominent, easy option in the sign-up/sign-in experience, not treated as a secondary or future enhancement. Where the same verified email address is used with both methods, the customer reaches the same CrownSourceGlobal account rather than ending up with two separate identities.
