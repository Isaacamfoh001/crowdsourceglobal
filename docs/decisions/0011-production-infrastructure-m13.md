# ADR 0011: Production Infrastructure Foundations (M13)

## Context

The M13 production-readiness audit found three concrete gaps between "correct commerce logic" and "safe to expose to real users": local-disk file storage that would silently lose sourcing/resolution attachments on any redeploy, no scheduling for the three existing background jobs, and no rate limiting anywhere, including login and password reset. This ADR records the three decisions made to close them, plus the residual client-IP trust question that fell out of the rate-limiting work.

## Object Storage: Cloudflare R2, Second `StorageProvider` Implementation

`lib/storage.ts`'s `StorageProvider` interface (M6) already separated domain code from a specific provider — `LocalDiskStorageProvider` was always documented as a dev-only shim with an explicit "replace before production" TODO. M13 adds `R2StorageProvider` (`lib/storage-r2.ts`) as the second implementation, selected via `STORAGE_PROVIDER` (`lib/env.ts`), which fails closed if left at `local` under `NODE_ENV=production`.

R2 was a given (specified for M13, not re-litigated here). The only real decision was **how** to talk to it: R2's S3-compatible API via the official `@aws-sdk/client-s3` SDK, rather than hand-rolling SigV4-signed requests. A client library isn't "AWS infrastructure" in the sense CLAUDE.md §6 warns against — it's the standard, correct way to call a documented S3-compatible API, and getting request signing wrong by hand is a real security footgun for a store that holds private customer/business files.

**Access model unchanged.** Both callers (`modules/sourcing`, `modules/resolutions`) already went through authenticated, ownership-checked download routes that stream bytes through the app rather than exposing a public/signed URL. R2StorageProvider preserves exactly that — the bucket itself is never configured for public access, and nothing about moving providers changes who can reach a given file. `readObject` does add one real behavior change: it distinguishes a missing object (returns `null`, same contract `LocalDiskStorageProvider` already had) from a genuine R2 failure — network, auth, 5xx — which now rethrows, so a download route's uncaught exception surfaces as a 500 instead of a misleading 404 telling a customer their evidence photo doesn't exist. `LocalDiskStorageProvider` is untouched; this is a real correctness improvement possible for R2 specifically (typed `NoSuchKey` exceptions) that wasn't cheaply available for the local-disk case.

**No migration tooling.** Every file in local dev storage today is development/demo data — see the milestone report for the explicit confirmation this was checked, not assumed. Production simply starts with an empty R2 bucket.

## Background Jobs: Scheduling Only, No Redesign

All three jobs (`jobs:email`, `jobs:sweep-payments`, `jobs:sweep-earnings`) were already correctly designed — bounded, idempotent (guarded `updateMany` claims), safe under concurrent/overlapping invocation, exit 0/1 appropriately. The gap was purely that nothing invoked them on a schedule. Render Cron Jobs run the existing npm scripts unchanged (no HTTP-endpoint wrapper needed, unlike a serverless-cron platform) — see `render.yaml` and `docs/deployment/render.md` for the chosen schedules and the reasoning behind each.

## Rate Limiting: Two Layers, One Postgres Table Pattern, No Redis

**Better Auth's own routes** (sign-in, sign-up, password reset, email verification) already ship conservative built-in limits (`getDefaultSpecialRules()` — 3 requests/10s on sign-in/sign-up, 3/60s on password-reset-request/verification-email, both keyed per client IP + path). The only configuration M13 adds (`lib/auth.ts`) is `storage: "database"` — the library's default is in-memory, which would silently reset every limit to zero on every restart/redeploy of this single-process Render web service, exactly the "misleading protection" the audit brief warned against. `storage: "database"` persists into a new `RateLimit` table (`prisma/schema.prisma`) via the same Prisma adapter already wired for Better Auth's other tables — no new infrastructure, no Redis.

**Custom server actions Better Auth doesn't own** — OTP submission, MoMo/card payment initiation, checkout order creation — needed their own mechanism. `lib/rate-limit.ts`'s `checkActionRateLimit()` is a small fixed-window limiter against a second table, `ActionRateLimit`, using the same guarded-`updateMany`-then-fallback-create idiom this codebase already established for `EmailDeliveryJob` claiming (`modules/notifications/repository.ts`) — deliberately not raw SQL against Better Auth's own table, to avoid coupling to an internal schema shape that library could change. This was evaluated against Redis explicitly, per the M13 brief's instruction to justify it: the concrete problem is "state must survive a process restart," Postgres already satisfies that, the traffic volume here (a handful of high-risk mutation endpoints, not every request) doesn't approach where a dedicated cache/counter store would out-perform a few indexed Postgres rows, and a second piece of infrastructure to provision, secure, and operate is a real ongoing cost for a one-developer team that a boring table doesn't carry.

## The Client-IP Trust Question Behind Render/Cloudflare

Both limiter layers key partly on client IP. Render sits behind Cloudflare; research during implementation (Render's own community/feedback channels — their public docs don't state this directly) surfaced a specific, non-obvious risk: **Render is documented to append to, not replace, any pre-existing `X-Forwarded-For` value a client sends.** A client that forges its own `X-Forwarded-For` header before the request reaches Render's edge can therefore land an attacker-chosen value ahead of the real client IP in the header the app sees — the opposite of the naive "leftmost entry is always the client" assumption that would otherwise be reasonable.

Cloudflare's `CF-Connecting-IP` header is the correct trustworthy alternative — set at Cloudflare's edge, not client-settable — but this repo has no independently verified confirmation that Render forwards it through to origin web services (only that Render forwards `CF-Ray`, a different header, was confirmed).

**Decision:** prefer `cf-connecting-ip` when present (`lib/auth.ts`'s `advanced.ipAddress.ipAddressHeaders`, and `lib/request-ip.ts` for the custom action limiter); fall back to `x-forwarded-for` **only when it is a single value** (both Better Auth's own IP resolution and `lib/request-ip.ts` already refuse a multi-value header without a verified trusted-proxy list, which this repo deliberately does not guess at). When neither resolves, requests collapse into one shared "unknown" bucket rather than trusting a potentially-spoofed value — a deliberately fail-safe direction: it can only make rate limiting more conservative (a availability/UX risk under unusual traffic), never less (never opens a silent bypass).

**Follow-up required before relying on this beyond defense-in-depth:** once deployed to Render, inspect real request headers (e.g., temporarily log `cf-connecting-ip`/`x-forwarded-for` for a handful of live requests) to confirm which header format Render actually delivers, and correct `ipAddressHeaders`/`lib/request-ip.ts` if reality differs from what's assumed here. This is exactly the kind of ambiguity CLAUDE.md §28 says to surface rather than silently resolve — recorded here instead of guessed away.

## Consequences

- Two new Prisma models (`RateLimit` — Better Auth-owned, `ActionRateLimit` — CrownSourceGlobal-owned), one migration, no new domain module.
- One new dependency, `@aws-sdk/client-s3`, used only by `lib/storage-r2.ts`.
- Production now fails closed (at startup) if `STORAGE_PROVIDER` is left at `local`, matching the existing `PAYMENT_PROVIDER=mock` guard's precedent.
- Rate-limit thresholds (`OTP_SUBMIT_RATE_LIMIT`, `PAYMENT_INITIATE_RATE_LIMIT`, `CHECKOUT_CREATE_RATE_LIMIT` in `lib/actions/*`, and Better Auth's own defaults) are operational defaults, not contractual — same "documented, configurable, not invented as a business rule" posture as `VENDOR_PAYOUT_HOLD_HOURS`/`QUOTE_VALIDITY_DAYS`.
- A distributed abuse-prevention platform, a generic job queue, and Redis were all explicitly evaluated and rejected for now, per CLAUDE.md §6's justification pattern — see the sections above for the concrete reasoning in each case.
