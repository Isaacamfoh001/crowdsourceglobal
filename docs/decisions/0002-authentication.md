# ADR 0002: Authentication — Better Auth (Email/Password + Google OAuth + Secure Linking)

## Context

CrownSourceGlobal must not hand-build authentication primitives (credential hashing, session security, email verification, password reset) — these are security-sensitive and well-solved by mature libraries. Authorization (customer ownership, vendor membership, admin permissions, resource-level access) must remain owned by CrownSourceGlobal regardless of which authentication library is used.

V1 requires **both**:
1. Email/password — registration, login, email verification, password reset/recovery, secure session management.
2. "Continue with Google" — OAuth sign-up and sign-in, presented as a prominent, easy option (not a secondary/future enhancement), with secure account linking when the same verified email is used across both methods.

## Options Considered

| | Better Auth | Auth.js (NextAuth) |
|---|---|---|
| Email/password + verification + reset | Built in as a core flow | Provider-first (OAuth-centric); credentials + verification/reset are typically hand-rolled on top |
| Google OAuth | First-class social provider, same config surface as credentials | First-class — Auth.js's traditional strength |
| Account linking (email/password ↔ Google, same email) | Built-in, configurable linking policy keyed on email match + verification | Possible, requires more custom wiring; not as turnkey |
| TypeScript/Prisma fit | Native, first-class Prisma adapter | Good, but more generic adapter layer |
| Maturity/ecosystem | Newer, smaller community | Very mature, large community |

## Decision

**Better Auth**, configured with both an email/password provider and a Google OAuth provider.

## Rationale

The actual requirement is "email/password + verification + reset + Google OAuth + safe linking between them" as one coherent system. Better Auth covers all of it natively; Auth.js is strong on the OAuth half but comparatively weaker on the credentials+verification+reset half, which is the specific gap CrownSourceGlobal is trying to avoid building itself. Adding the Google OAuth requirement did not change the original recommendation — it sharpened it, since Better Auth's built-in account-linking behavior is purpose-built for exactly this combined scenario.

## Account Linking Policy (Secure Default)

- Linking triggers only when Google reports the email as **verified** and it exactly matches an existing account's email.
- An email/password user later using "Continue with Google" with the same verified email is auto-linked to the same `User`/`CustomerProfile` — no duplicate identity is created.
- A Google-first user has a `User` record with no password set; they may later add a password via a standard "set password" flow (supported, not required for V1).
- Linking is **never** performed against an unverified email on either side — this prevents account takeover via an attacker-controlled unverified address.
- Both methods converge on the same `User → CustomerProfile` model (see `/docs/domain/entities.md`) — no schema divergence between authentication methods.

## Division of Responsibility

Better Auth owns `User`, credentials, OAuth accounts, sessions, verification/reset tokens. CrownSourceGlobal owns `CustomerProfile`, `VendorMembership`, admin role assignment, and every authorization policy check in `/modules/*`. A valid Better Auth session establishes identity only, never permission.

## Consequences

- Login/register UI must present "Continue with Google" prominently alongside email/password fields, not as a buried secondary option.
- Google OAuth client credentials (a Google Cloud OAuth app) are a required M0 setup task — quick to obtain, not a business blocker.
- Any future addition of further OAuth providers follows the same linking policy pattern already established here.
