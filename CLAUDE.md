# CrownSourceGlobal — Claude Code Instructions

## 1. Purpose

You are assisting with the design and implementation of CrownSourceGlobal.

The complete current product brief is located at:

`PROJECT.md`

Read `PROJECT.md` before performing project work.

Do not assume product requirements from previous sessions when they conflict with the repository documentation.

---

# 2. Current Phase

The project is currently in the:

**product definition + UX planning + system architecture planning phase.**

There is intentionally little or no production application code yet.

Until explicitly instructed otherwise:

> **Do not create production application code.**

The immediate objective is to produce a well-reasoned technical architecture before implementation begins.

---

# 3. Product Source of Truth

`PROJECT.md` defines the current product vision and requirements.

The central product model is:

**Customer → CrownSourceGlobal → Vendor**

CrownSourceGlobal is a **commerce-first managed marketplace**, not an RFQ-first procurement application.

The three primary customer purchase paths are:

1. standard e-commerce purchase;
2. bulk purchase with instant quotation where pricing is known;
3. custom sourcing/custom quotation where manual intervention is required.

Do not redesign ordinary purchases into RFQ workflows.

Do not create direct customer-vendor communication unless explicitly instructed.

---

# 4. Your Role During Architecture Planning

Act as a senior software architect working collaboratively with the project owner.

Your job is not merely to select technologies.

Your job is to:

- understand the business;
- identify important domain boundaries;
- expose ambiguities;
- identify architectural risks;
- compare reasonable approaches;
- explain tradeoffs;
- recommend appropriate solutions;
- challenge unnecessary complexity;
- identify security/data-integrity requirements;
- plan for production operation;
- document approved decisions.

Architecture should follow product requirements rather than forcing the product into a preferred technology stack.

---

# 5. Planning Before Implementation

Before recommending implementation details:

1. read `PROJECT.md`;
2. summarize relevant product requirements;
3. inspect any existing project documentation;
4. identify assumptions;
5. identify material ambiguities;
6. determine which decisions are reversible and which are expensive to reverse;
7. compare reasonable options;
8. explain tradeoffs;
9. recommend an approach.

Do not prematurely generate large amounts of application code.

---

# 6. Do Not Overengineer

The initial engineering team is small.

Prioritize:

- simplicity;
- maintainability;
- security;
- developer productivity;
- operational simplicity;
- reasonable cost;
- testability;
- data integrity;
- future extensibility.

Do not introduce infrastructure because it is fashionable or because it might theoretically be useful at massive scale.

Do not assume the project needs:

- microservices;
- Kubernetes;
- Kafka;
- Redis;
- message brokers;
- multiple databases;
- dedicated search clusters;
- separate frontend/backend services;
- event sourcing;
- CQRS;
- complex distributed systems.

These are not prohibited.

If recommending one, explain:

1. the concrete problem it solves;
2. why CrownSourceGlobal currently has that problem;
3. the simpler alternative;
4. why the simpler alternative is insufficient;
5. operational implications;
6. cost;
7. complexity.

---

# 7. Architecture Evaluation Criteria

When comparing architecture options, evaluate:

## Product Fit

Does the architecture naturally support the product?

## Complexity

How difficult is it to build, understand, debug, and maintain?

## Development Speed

Can a small engineering team deliver reliably?

## Security

Does it provide strong authentication, authorization, payment, and data boundaries?

## Data Integrity

Can critical commerce operations remain consistent?

## Scalability

Can the architecture scale reasonably without premature distributed complexity?

## Operational Cost

What infrastructure and maintenance burden does it introduce?

## Developer Experience

Can developers work productively and safely?

## Testability

Can important domain behavior be tested independently?

## Observability

Can failures be detected and investigated?

## Future Evolution

Can major future requirements be introduced without rewriting the entire platform?

---

# 8. Architecture Areas To Design

The architecture planning process should eventually address:

- repository structure;
- frontend architecture;
- rendering strategy;
- backend architecture;
- API/application boundaries;
- database;
- data modeling;
- ORM/data access;
- authentication;
- authorization;
- organization/vendor membership;
- catalogue;
- pricing;
- cart;
- checkout;
- quotations;
- custom sourcing;
- orders;
- fulfilments;
- payments;
- refunds;
- vendor payouts;
- invoices/documents;
- messaging;
- notifications;
- file storage;
- search;
- caching;
- background processing;
- scheduled tasks;
- email;
- audit logging;
- analytics;
- testing;
- CI/CD;
- deployment;
- observability;
- error monitoring;
- secrets;
- backups;
- disaster recovery;
- environment management.

Do not attempt to solve every area simultaneously if a staged approach would produce better reasoning.

---

# 9. Domain Modeling Principles

Do not allow implementation convenience to erase important business distinctions.

Important distinctions include:

### Order vs Fulfilment

A customer order represents what CrownSourceGlobal sold to the customer.

A vendor fulfilment represents work assigned to a vendor.

One order may produce multiple vendor fulfilments.

### Customer Payment vs Vendor Payout

Customer payment and vendor payout are separate financial events.

### Instant Quotation vs Custom Quotation

Instant quotations derive from known pricing rules.

Custom quotations may result from manual sourcing.

### Vendor Cost vs Customer Price

These are conceptually different values.

Do not expose either across trust boundaries without an explicit business rule.

### Current Product Price vs Historical Transaction Price

Orders, quotations, invoices, and receipts must preserve historical commercial values.

Do not derive historical financial records from mutable current product prices.

---

# 10. Commerce Integrity

Critical commerce operations require careful design.

Examples:

- checkout;
- payment confirmation;
- quotation acceptance;
- order creation;
- refunds;
- fulfilment creation;
- payout processing.

Consider:

- database transactions;
- uniqueness constraints;
- idempotency;
- concurrency;
- retries;
- duplicate requests;
- payment-provider webhooks;
- partial failure;
- auditability.

Never assume a frontend button being clicked once means the backend operation will execute once.

---

# 11. Payments

Customers pay CrownSourceGlobal rather than vendors directly through the marketplace.

However:

> Do not assume CrownSourceGlobal legally operates an escrow, wallet, or regulated custodial payment service.

The exact commercial/payment arrangement must be confirmed.

When designing payment architecture:

- separate customer payment from vendor payout;
- design for webhook verification;
- design for idempotency;
- preserve external references;
- consider refunds;
- consider reconciliation;
- consider failed payments;
- consider partial failures;
- consider audit requirements;
- identify regulatory/business assumptions rather than silently inventing them.

---

# 12. Authorization

Authorization is a server-side concern.

Never treat UI visibility as security.

At minimum, consider boundaries between:

- public visitor;
- customer;
- vendor user;
- administrator.

Potential future organization/business accounts should be considered without unnecessarily complicating ordinary individual customer accounts.

Examples of required isolation:

- Customer A must not access Customer B's private order.
- Vendor A must not access Vendor B's private data.
- Vendor A must only access fulfilments assigned to Vendor A.
- Vendors must not access customer-facing conversations.
- Customers must not access vendor operational information.
- Administrative functions require explicit privileges.

Default to denying access when authorization is ambiguous.

---

# 13. Communication Boundary

The marketplace deliberately prevents direct customer-vendor communication.

Customer communication:

**Customer ↔ CrownSourceGlobal**

Vendor operational communication:

**CrownSourceGlobal ↔ Vendor**

Do not accidentally introduce:

**Customer ↔ Vendor**

through:

- messaging;
- exposed email addresses;
- exposed phone numbers;
- order data;
- fulfilment data;
- storefronts;
- notifications;
- APIs.

If customer enquiries originate from vendor/product pages, preserve the context while routing communication to CrownSourceGlobal.

---

# 14. Security

Security is a first-class architecture concern.

Consider:

- authentication;
- authorization;
- secure sessions;
- CSRF where applicable;
- XSS;
- injection;
- input validation;
- rate limiting;
- payment security;
- webhook signatures;
- file upload validation;
- secure object access;
- secrets management;
- logging hygiene;
- least privilege;
- administrative access;
- auditability.

Never put secrets into client-side code.

Never trust client-provided ownership or authorization claims.

---

# 15. File Uploads

Potential uploads include:

- product images;
- vendor documents;
- custom sourcing attachments;
- company documents;
- possibly invoices/documents.

Architecture should consider:

- storage;
- allowed file types;
- size limits;
- access control;
- malware/security considerations;
- public vs private files;
- signed access where appropriate;
- lifecycle/deletion.

Do not store arbitrary user uploads directly inside the application repository.

---

# 16. Search

Start with the simplest search architecture that meets realistic requirements.

Do not introduce Elasticsearch, OpenSearch, Algolia, Meilisearch, or similar infrastructure automatically.

Evaluate whether database-backed search is sufficient initially.

If recommending dedicated search, justify it with concrete requirements.

---

# 17. Caching

Do not add Redis or another cache merely because the application is a marketplace.

First identify:

- what is expensive;
- what requires caching;
- expected load;
- acceptable staleness;
- invalidation strategy.

Prefer no cache over an unnecessary cache.

Add caching when evidence or clear architecture requirements justify it.

---

# 18. Background Work

Potential asynchronous operations may include:

- email;
- notification delivery;
- PDF generation;
- payment processing follow-up;
- image processing;
- scheduled cleanup;
- payout processing;
- reporting.

Determine whether these require background jobs and what level of infrastructure is appropriate.

Do not assume a distributed queue is required.

---

# 19. Frontend / UX Architecture

The public customer experience should feel like modern commerce.

Do not expose internal administrative or procurement complexity unnecessarily.

Important experiences include:

### Public

- landing page;
- product discovery;
- categories;
- product pages;
- vendor storefronts;
- bulk purchasing;
- custom sourcing;
- vendor acquisition.

### Customer

- cart;
- checkout;
- quotes;
- custom requests;
- orders;
- messages;
- documents;
- account.

### Vendor

- dashboard;
- products;
- fulfilments;
- payouts;
- notifications;
- company profile.

### Admin

- marketplace operations;
- vendor/customer management;
- product moderation;
- custom sourcing;
- quotations;
- orders;
- fulfilments;
- payments;
- payouts;
- support;
- analytics.

Use shared UI/design primitives where appropriate while maintaining clear role-specific experiences.

---

# 20. Mobile Responsiveness

The public marketplace and customer purchase experience must work well on mobile.

Do not design desktop-only flows and attempt to retrofit mobile afterward.

Consider responsive behavior during component and information-architecture planning.

---

# 21. Testing Philosophy

Architecture should support multiple levels of testing.

Potential layers:

- unit tests for domain/business logic;
- integration tests for persistence/application behavior;
- API tests where applicable;
- end-to-end tests for critical customer workflows.

High-value E2E flows likely include:

- standard purchase;
- bulk quotation → checkout;
- custom request → custom quote → purchase;
- payment confirmation → order creation;
- multi-vendor order → fulfilments;
- vendor product submission → admin approval;
- vendor fulfilment;
- payout-related workflows.

Do not optimize for meaningless test counts.

Prioritize tests around high-risk business behavior.

---

# 22. Observability

Production architecture should allow operators to answer questions such as:

- Why did this payment fail?
- Why was an order not created?
- Why did a vendor not receive a fulfilment?
- Why did a notification fail?
- Who changed this quotation?
- What happened to this payout?
- Which request produced this error?

Plan appropriate:

- structured logging;
- error monitoring;
- audit events;
- correlation/request IDs where useful;
- health monitoring.

Avoid logging secrets or unnecessarily sensitive information.

---

# 23. Documentation

As architecture decisions are approved, propose appropriate documentation under `/docs`.

Possible future structure:

`docs/architecture/`
`docs/domain/`
`docs/workflows/`
`docs/decisions/`

Do not generate dozens of speculative documents simply for completeness.

Documentation should capture decisions that help humans and coding agents understand the system.

---

# 24. Architectural Decision Records

For major decisions that are difficult or expensive to reverse, consider documenting:

- context;
- options considered;
- decision;
- rationale;
- tradeoffs;
- consequences.

Examples might include:

- application architecture;
- database;
- authentication strategy;
- payment architecture;
- deployment model.

Do not create ADRs for trivial implementation details.

---

# 25. Documentation vs Implementation

Once implementation begins, documentation should remain useful rather than becoming ceremonial.

If code and documentation conflict on important:

- product behavior;
- security;
- architecture;
- workflow;
- financial logic;

report the conflict.

Do not silently decide which is correct.

---

# 26. Implementation Phase — Future Instructions

Once explicitly told that implementation may begin:

Before significant features:

1. read relevant documentation;
2. inspect existing code;
3. understand current conventions;
4. propose implementation plan;
5. identify files affected;
6. identify data/API/security implications;
7. wait for approval when requested.

During implementation:

- keep changes scoped;
- prefer strong typing;
- validate external input;
- enforce authorization server-side;
- centralize important business rules;
- avoid duplication;
- avoid unnecessary abstractions;
- preserve domain boundaries.

After implementation:

run applicable:

- formatter;
- type checker;
- linter;
- unit tests;
- integration tests;
- E2E tests.

Report what was actually executed.

Never claim tests passed without running them.

---

# 27. Git Safety — Future Implementation

Once source code exists:

- do not push directly to `main` unless explicitly instructed;
- do not force push unless explicitly instructed;
- do not rewrite history unless explicitly instructed;
- do not commit secrets;
- prefer focused feature branches;
- keep unrelated changes out of feature work.

If asked only to inspect, review, investigate, or plan:

> Do not modify application files.

---

# 28. Handling Ambiguity

Not every small ambiguity requires interruption.

Use reasonable engineering judgment for low-impact implementation details.

However, explicitly surface ambiguity when it materially affects:

- business behavior;
- pricing;
- payments;
- refunds;
- payouts;
- customer/vendor relationships;
- security;
- authorization;
- data ownership;
- legal/compliance assumptions;
- architecture;
- expensive-to-reverse decisions.

Do not invent critical business rules.

---

# 29. Challenge Assumptions

Do not simply agree with proposed architecture.

If a requested approach appears:

- unnecessarily complex;
- insecure;
- expensive;
- difficult to operate;
- inconsistent with the product;
- difficult to maintain;

explain the concern and propose alternatives.

Likewise, do not reject an approach solely because another technology is more fashionable.

Evaluate decisions based on CrownSourceGlobal's actual requirements.

---

# 30. Current Planning Objective

The first architecture planning cycle should ultimately produce a coherent answer to:

1. What are the major system/domain boundaries?
2. What application architecture should be used?
3. Should the initial system be a modular monolith or something else?
4. What should the frontend architecture be?
5. What should the backend architecture be?
6. Should frontend/backend be one application or separate applications?
7. What database should be used?
8. What should the data model look like?
9. How should authentication work?
10. How should authorization work?
11. How should customer/business/vendor identities be modeled?
12. How should product/catalogue data work?
13. How should pricing and bulk pricing work?
14. How should cart/checkout work?
15. How should instant quotations work?
16. How should custom sourcing work?
17. How should orders and fulfilments relate?
18. How should customer payments work?
19. How should vendor payouts work?
20. How should documents/invoices work?
21. How should messaging work?
22. How should notifications work?
23. How should file storage work?
24. What background processing is actually required?
25. What search architecture is appropriate?
26. What caching, if any, is appropriate?
27. How should the system be tested?
28. How should it be deployed?
29. How should it be monitored?
30. What are the major risks and future scaling paths?

Do not answer all thirty superficially in one giant response.

Develop the architecture systematically.

---

# 31. First Interaction

When first asked to begin architecture planning:

1. Read `PROJECT.md` completely.
2. Read this file completely.
3. Do not modify production/application files.
4. Summarize your understanding of CrownSourceGlobal.
5. Describe the major domains you believe exist.
6. Identify any product ambiguities that materially affect architecture.
7. Identify the major architectural decisions ahead.
8. Recommend a logical sequence for designing the architecture.

Do **not** immediately choose the final technology stack.

First establish shared understanding of the product.

---

# 32. Guiding Principle

The goal is not to create the most sophisticated architecture.

The goal is to create:

> **the simplest production-grade architecture that correctly supports CrownSourceGlobal's business model, protects its users and financial workflows, is maintainable by a small team, and can evolve as the business grows.**

---

# 33. Approved V1 Engineering Rules

Architecture planning is complete. The following are approved, durable engineering rules for implementation. They refine, rather than replace, the general principles above (particularly Sections 6, 9–14, 16–18, 21). Detailed reference material lives under `/docs`; this section states the binding rules, not the full rationale.

## 33.1 Approved Application Architecture

Single Next.js (App Router) application, TypeScript, PostgreSQL, Prisma. A modular monolith: business/domain logic lives in framework-agnostic modules under `/modules`, each with its own service, repository, and authorization policy, called by thin route handlers/server actions. No microservices, Redis, Kafka, or dedicated search infrastructure for V1 absent a concrete, demonstrated problem, per Section 6's justification pattern.

Background/async work uses a database-backed job table with a polling worker process — no message broker. See `/docs/architecture/overview.md` for the full comparison and rationale.

## 33.2 Authentication vs. Authorization

Authentication — credentials, password hashing, sessions, email verification, password reset, Google OAuth sign-in, and secure account linking between the two methods — is handled by Better Auth. Do not hand-build these primitives.

Authorization — customer ownership, vendor membership, admin permissions, resource-level access — is owned entirely by CrownSourceGlobal, implemented as a policy function per domain module, checked at the start of every mutation and query. Never conflate the two: a valid Better Auth session establishes identity only, never permission.

Account linking between authentication methods occurs only when the email is verified and matches exactly on both sides, using Better Auth's built-in secure linking behavior. Never silently merge unverified identities into an existing account. See `/docs/decisions/0002-authentication.md`.

## 33.3 Financial Snapshot Rule

`OrderItem` is the first point at which standard (cart-based) purchase economics — customer price and vendor-payable basis — become authoritative, captured at checkout revalidation. For quotation-origin orders, `OrderItem` copies the already-locked `Quotation` terms verbatim rather than re-deriving them.

`FulfilmentItem` is never an independent source of pricing truth. It always copies its economics from its parent `OrderItem` at the moment Fulfilment is created (order confirmation), and never re-derives from live pricing. See `/docs/workflows/workflows.md`.

## 33.4 Vendor Listing Is the Sellable Unit

Do not introduce a canonical cross-vendor "Product" with vendor-specific "Offers" without an explicit future product decision. `VendorListing` is self-contained and vendor-owned. See `/docs/decisions/0003-vendor-listing-vs-product.md`.

## 33.5 Refund/Payout Corrections

Post-hoc corrections to vendor payout after a payout has already run use a payout-hold flag and payout-adjustment records, netted into a future payout run. Do not build a full accounting ledger without a demonstrated need beyond what this mechanism covers. See `/docs/decisions/0005-payout-refund-adjustment.md`.

## 33.6 Testing Expectations

In addition to the general testing philosophy in Section 21, the following named end-to-end workflows are the reference implementation checklist: standard single-vendor purchase, standard multi-vendor purchase, bulk/instant quotation purchase, custom sourcing → quotation → order, payment confirmation, failed/abandoned payment, inventory reservation/release, fulfilment and partial shipment, delivery completion, vendor payout, cancellation/refund, buyer↔CrownSource messaging, vendor↔CrownSource messaging. Full definitions are in `/docs/workflows/workflows.md`.

## 33.7 Documentation Map

`/docs/architecture/overview.md` — domain/module map, application architecture shape, technology stack, repository structure.
`/docs/domain/entities.md` — data model.
`/docs/domain/state-machines.md` — entity state machines.
`/docs/workflows/workflows.md` — end-to-end workflow references.
`/docs/decisions/` — ADRs for decisions that are expensive to reverse.

If code and this documentation conflict on product behavior, security, architecture, workflow, or financial logic, report the conflict per Section 25 — do not silently decide which is correct.
