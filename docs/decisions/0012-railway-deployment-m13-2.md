# ADR 0012: Deployment Target Changed to Railway (M13.2)

## Context

M13 (ADR 0011) targeted Render: Web Service + Managed PostgreSQL + Cron Jobs, described in `render.yaml` and `docs/deployment/render.md`. After reviewing actual cost and operational requirements, the chosen host changed to Railway before any real deployment happened — no account was ever created, nothing was ever deployed. This ADR records what stayed the same, what had to change, and two genuine Railway-specific risks found during adaptation.

## What Stayed Exactly The Same

The M13 audit's central finding was that this application's production gaps were narrow and platform-independent: Cloudflare R2 storage, Postgres-backed rate limiting, the three background jobs, Prisma production configuration, Node version pinning, and `lib/env.ts`'s fail-closed validation. None of that changed. `lib/storage.ts`/`lib/storage-r2.ts`, `lib/rate-limit.ts`, `prisma/schema.prisma`, `scripts/*.ts`, and `lib/env.ts`'s validation/fail-closed logic are untouched. The application still doesn't know or care which host it's running on — that was the point of building it that way in M13.

## Deployment Configuration: Dashboard, Not a Committed Config File

Render's `render.yaml` (a "Blueprint") was a natural fit because Render treats it as the primary, stable way to describe a multi-service topology. Railway's equivalent — `railway.json`/`railway.toml` ("Config as Code") — is **being deprecated**: Railway's own documentation states these files stop being read on **2026-12-01**, replaced by a newer Infrastructure-as-Code mechanism (`.railway/railway.ts`) that is too new to commit to with confidence for a production deployment config right now.

Given the M13.2 brief's own instruction to prefer minimal configuration and avoid introducing custom build infrastructure, and given Railway's zero-config Nixpacks/Railpack builder already correctly detects a Node/Next.js project, the decision here is to **configure the four services (web + 3 cron jobs) directly in the Railway dashboard** — exact Build/Pre-Deploy/Start commands and cron schedules set per service — rather than committing a config file that would need replacing again within months. `docs/deployment/railway.md` documents the exact dashboard steps in place of a `railway.yaml`. If Railway's new IaC mechanism matures and stabilizes, revisiting this is a small, contained future change — it doesn't touch application code.

## Two Genuine Railway-Specific Risks Found (Not Hypothetical)

**1. `prisma` and `tsx` were in `devDependencies`.** Railway's build pipeline is reported (Railway's own community support forum — multiple independent threads with the same diagnosis) to prune `devDependencies` before the pre-deploy/runtime stage, unlike a plain local `npm ci`. Since `prisma migrate deploy` needs the `prisma` CLI at pre-deploy time, and all three scheduled jobs run via `tsx scripts/*.ts` at cron runtime — both squarely *after* any such pruning — this would have failed on Railway specifically (`prisma: command not found` / `tsx: command not found`) despite working fine locally and (as far as could be determined) on Render. Fixed by reclassifying both as regular `dependencies` (`package.json`) — the standard, minimal fix for this exact situation, not a Docker/build-infrastructure change.

**2. The M13 rate-limiting IP-trust logic (`lib/request-ip.ts`, `lib/auth.ts`) was researched specifically for Render sitting behind Cloudflare.** ADR 0011 documented that Render is reported to *append to* rather than replace a client-supplied `X-Forwarded-For` header, making its leftmost entry unsafe to trust without a verified proxy list — the code was written defensively around that finding. Railway's behavior is reported to be materially different and more favorable: Railway's edge proxy is reported to strip/replace any client-supplied `X-Forwarded-For` rather than merely appending to it, making the leftmost entry trustworthy, and Railway additionally provides `X-Real-IP` as a dedicated single-value client-IP header. Both `lib/auth.ts`'s `ipAddressHeaders` and `lib/request-ip.ts` were updated to prefer `x-real-ip`, then trust `x-forwarded-for`'s leftmost entry directly (no longer requiring it be single-valued, since Railway — unlike Render — is reported to control that header itself). `cf-connecting-ip` stays first in preference order: harmless when absent, and relevant again if a future custom domain is proxied through Cloudflare.

Both findings come from Railway's own community support forum, not Railway's official documentation directly — treated with the same "sourced, flagged if uncertain" discipline this codebase already applies to Paystack/Moolre provider behavior (see ADR 0007). **Recommended**: once deployed, verify real incoming request headers match this understanding — Railway has separately noted it is actively rolling out new CDN/edge infrastructure, which could change this. This is the same kind of one-time manual verification ADR 0011 already asked for on Render; it was never performed there (no deployment happened) and is carried forward as a task for Railway instead.

## What Changed, Mechanically

- `render.yaml` deleted; `docs/deployment/render.md` replaced by `docs/deployment/railway.md`.
- `package.json`: `prisma`, `tsx` moved from `devDependencies` to `dependencies`.
- `lib/auth.ts`, `lib/request-ip.ts`: IP-header preference order updated (see above); the rate-limiting *mechanism* itself (Postgres-backed, `RateLimit`/`ActionRateLimit` tables, fixed-window/guarded-`updateMany` design) is completely unchanged.
- `lib/db.ts`, `lib/env.ts`, `lib/rate-limit.ts`: comments that named Render specifically reworded to be platform-generic (the underlying reasoning — one process, one bounded pool — never depended on Render in the first place).
- `docs/architecture/overview.md`: Hosting row updated to Railway.
- Background jobs (`scripts/*.ts`), storage architecture, database schema, and every business-logic module: **unchanged**, per this milestone's explicit scope.

## Consequences

- No Docker, no Nixpacks customization, no committed Railway config file — deployment configuration lives in the Railway dashboard, documented step-by-step in `docs/deployment/railway.md`.
- `DATABASE_URL` is wired via Railway's reference-variable syntax (`${{Postgres.DATABASE_URL}}`), not a pasted connection string — see `docs/deployment/railway.md` §Database.
- Environment variables shared across all four services (web + 3 jobs) use Railway's **Shared Variables** (project-level, scoped per environment) rather than repeating ~20 variables four times by hand, the way `render.yaml`'s YAML-anchor trick did — a genuine ergonomic improvement, not just a like-for-like port.
- ADR 0011 remains the historical record of the original M13 decisions and Render-specific analysis; it is superseded on deployment-target specifics by this ADR, not rewritten.
