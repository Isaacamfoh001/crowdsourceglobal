# ADR 0003: VendorListing as the Sellable Unit (No Canonical Cross-Vendor Product)

## Context

Two vendors may sell similar or identical items (e.g., "22-inch Human Hair") at different prices and stock levels. The initial domain model considered a canonical `Product` shared across vendors with per-vendor `Offer`/`Listing` records (an Amazon-style "buy box" model), versus treating each vendor's listing as an entirely independent sellable entity.

Normal marketplace shopping was also clarified to be customer-directed: the customer explicitly picks which vendor's listing and how much quantity from each, rather than CrownSourceGlobal automatically splitting a requested quantity across vendors.

## Options Considered

**A. `VendorListing` is the sellable unit; no canonical Product.** Each vendor's listing is self-contained (title, description, images, price, availability). Two vendors selling similar items are simply two independent listings, related only by shared Category.

**B. Canonical `Product` + per-vendor `Offer`.** A shared Product record with vendor-specific Offers, requiring product matching/deduplication across vendors (who "owns" the canonical title/images, how matching is performed, an admin canonicalization workflow).

## Decision

**Option A.** `VendorListing` is the sellable unit.

## Rationale

Option B is a materially heavier feature (catalogue deduplication/matching, buy-box competition semantics, an admin canonicalization workflow) that nothing in the product brief requires — PROJECT.md's own multi-vendor shopping example (a customer buying 40 units from Vendor A's listing and 60 from Vendor B's listing) already reads naturally as two independent listings, not a shared product with allocation logic. Option A directly satisfies that example with zero allocation logic: the customer's cart line items *are* the allocation, because there is no shared entity to split.

This also cleanly resolves how normal multi-vendor shopping differs from custom sourcing's internal allocation (see `/docs/workflows/workflows.md`): normal shopping needs no allocation mechanism at all, while custom sourcing's internal vendor split is handled entirely within `OrderItem`/`FulfilmentItem`, not by a Product/Offer layer.

## Consequences

- `VendorListing` carries all catalogue and pricing-linked data (via `Pricing`/`VendorCostRule`) itself; there is no shared "Product" row it points to.
- Two vendors' similar listings surface to customers as separate marketplace entries connected only by shared Category, not as competing offers on one product page.
- A future canonical product-matching/buy-box feature is possible but is a distinct, later product decision — see PROJECT.md §54.2 — not assumed for V1.
