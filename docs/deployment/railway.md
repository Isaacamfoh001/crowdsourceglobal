# Deploying CrownSourceGlobal on Railway (M13.2)

Practical reference for the intended production/staging topology and every manual step Railway/Cloudflare/Resend/Paystack/Google require outside this repo. Nothing in this repo creates external accounts, services, or credentials — see the milestone report for the full manual checklist. Supersedes `docs/deployment/render.md` (removed) — see `docs/decisions/0012-railway-deployment-m13-2.md` for why the target changed and what that did/didn't affect.

## 1. Runtime architecture

```
GitHub
   ↓
Railway (one project, four services)
   ├── crownsourceglobal (web) — npm run start, single Next.js process
   ├── Postgres (Railway plugin)
   ├── crownsourceglobal-jobs-email          */5 * * * *  (every 5 min)
   ├── crownsourceglobal-jobs-sweep-payments */5 * * * *  (every 5 min)
   └── crownsourceglobal-jobs-sweep-earnings 0 * * * *    (hourly)

Cloudflare R2 — private bucket, sourcing/resolution attachments + product images
Resend — transactional email
Paystack — customer payments/refunds, vendor payouts (manual fallback while Starter Business)
Google OAuth — "Continue with Google"
```

All Railway cron schedules are evaluated in **UTC**. Railway's minimum cron interval is 5 minutes — the email job moved from M13's every-2-minutes (Render) to every 5 minutes; its own bounded backoff (`[1,5,30,120,720]` minutes) already tolerates a coarser poll interval fine.

## 2. No committed Railway config file — configure services in the dashboard

Unlike M13's `render.yaml`, this repo does **not** commit a `railway.json`/`railway.toml`. Railway's own docs say that format is deprecated (stops being read 2026-12-01), and Railway's Next.js zero-config detection already gets most of the way there — see ADR 0012 for the full reasoning. Configure each service directly in its Settings tab as documented below (§3, §5). This also means there's nothing to keep "in sync" with a config file — the dashboard is the single source of truth.

## 3. Web service configuration (dashboard: Settings → Build / Deploy)

| Setting | Value |
|---|---|
| Build Command | `npm ci && npm run build` |
| Pre-Deploy Command | `npm run prisma:migrate:deploy` |
| Start Command | `npm run start` |
| Node version | 22.x — from `package.json`'s `engines.node` (`>=22.12.0 <23.0.0`), auto-detected by Railway's builder. No `nixpacks.toml` needed. |
| Healthcheck path | None configured — optional on Railway, and this app has no dedicated `/health` route. `/` (a real, working page) can be used if Railway requires a path; not required to deploy successfully. |

**Pre-Deploy Command runs in a separate, isolated container from the running app**, after build, before the new version receives traffic — this is Railway's direct equivalent of what `render.yaml` used `preDeployCommand` for, and is the correct place for `prisma migrate deploy` (never in the start command, which would risk re-running migrations on every restart/scale event).

**Why `prisma` and `tsx` moved to `dependencies`** (`package.json`, M13.2): Railway's build pipeline is reported to prune `devDependencies` before the pre-deploy/runtime stage. `prisma migrate deploy` needs the `prisma` CLI at pre-deploy time; all three cron jobs need `tsx` at runtime. Both are now regular dependencies so they survive that pruning. See ADR 0012.

## 4. Railway PostgreSQL

Add a **Postgres** plugin/service to the same Railway project (New → Database → Add PostgreSQL). Do not create it — this is a manual step for you (§J).

Connect it to the web service and all three job services by adding, in each service's Variables tab:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

This is Railway's **reference variable** syntax — it resolves to Postgres's *private* internal connection string at deploy time (fast, free, doesn't leave Railway's network). Do **not** use `${{Postgres.DATABASE_PUBLIC_URL}}` for the app services — that's the externally-reachable URL, only useful for connecting from your own machine (e.g., `psql` for a one-off manual check), and unnecessary here since every service that needs the database already runs inside the same Railway project.

`DATABASE_POOL_MAX` (`lib/env.ts`, default 10) remains appropriate unchanged — this is still one always-on process per service (not per-request serverless), and Railway's Postgres plugin's default connection limit comfortably accommodates the web service's pool (10) plus each job's smaller pool (5, set explicitly per job service's variables) running briefly and exiting. No connection-pooling infrastructure (PgBouncer, etc.) is warranted at this scale — keep it that way unless real connection-exhaustion evidence appears.

## 5. Scheduled jobs (dashboard: each service's Settings → Cron Schedule)

Create three additional services in the same Railway project, each deploying from the **same GitHub repo**, differing only in Start Command and Cron Schedule:

| Service | Build Command | Start Command | Cron Schedule |
|---|---|---|---|
| `crownsourceglobal-jobs-email` | `npm ci` | `npm run jobs:email` | `*/5 * * * *` |
| `crownsourceglobal-jobs-sweep-payments` | `npm ci` | `npm run jobs:sweep-payments` | `*/5 * * * *` |
| `crownsourceglobal-jobs-sweep-earnings` | `npm ci` | `npm run jobs:sweep-earnings` | `0 * * * *` |

All three scripts (`scripts/*.ts`) are unchanged from M13 — confirmed bounded (each does a fixed unit of work against current DB state, not an open-ended loop) and confirmed to `process.exit(0)` on success / `process.exit(1)` on a fatal error (verified live — see the milestone report's Validation section). Each is idempotent under overlapping invocation via a guarded `updateMany` claim, so Railway's own documented behavior — skipping the next scheduled run if the previous one hasn't finished — is a safety margin, not a correctness requirement.

No Build Command's own `npm run build` step is needed for the three job services — they only ever run a `tsx` script directly, never `next build`/`next start`.

## 6. Environment variables — Shared Variables

Rather than re-entering ~20 variables on four services separately (the way `render.yaml`'s YAML-anchor trick worked around Render's per-service model), use Railway's **Shared Variables**: Project Settings → Shared Variables → pick the environment (staging/production) → add each variable once → share it to all four services. Each service then holds a reference (`${{shared.VARIABLE_NAME}}`), and rotating a value later means updating it in exactly one place. See the milestone report's Environment Variables section for the exact list and which values are staging-specific.

## 7. Local vs. production storage

Unchanged from M13. `STORAGE_PROVIDER` (`lib/env.ts`) selects the implementation `lib/storage.ts` exports — `local` (dev/test only, does not survive a restart) or `r2` (`R2StorageProvider`, `lib/storage-r2.ts`). Production fails to start if `NODE_ENV=production` and `STORAGE_PROVIDER` is left at `local`. Sourcing attachments, resolution evidence, and (as of M13.1) product images all go through the same `StorageProvider` interface — nothing storage-related is Railway-specific.

## 8. Cloudflare R2 setup (manual, external — unchanged from M13)

1. Create (or use an existing) Cloudflare account and enable R2.
2. Create one bucket for CrownSourceGlobal — do **not** enable public access on it.
3. R2 → Manage API Tokens → create a token scoped to only that bucket (read + write + delete), not the account-wide API key.
4. Note the Account ID (R2 → Overview) and the token's Access Key ID / Secret Access Key.
5. Set as Shared Variables (§6): `STORAGE_PROVIDER=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

## 9. Rate limiting — what's protected and how

Mechanism unchanged from M13 (both layers Postgres-backed, no Redis — ADR 0011). What changed for Railway (M13.2, ADR 0012): the client-IP header preference. Railway's edge is reported to sanitize `X-Forwarded-For` itself (unlike Render, which only appended to a client-supplied value) and additionally provides `X-Real-IP`. `lib/auth.ts`/`lib/request-ip.ts` now prefer `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for` (leftmost entry). **Read ADR 0012's risk section before relying on this for anything beyond defense-in-depth** — it's sourced from Railway's community forum, not confirmed in Railway's own docs, and Railway has noted it's actively changing its edge/CDN infrastructure. Verify real incoming headers once deployed.

## 10. Database migrations

**`npm run prisma:migrate:deploy`** runs as the web service's Pre-Deploy Command (§3) — once per deploy, isolated from the running app, before traffic switches over. Never `prisma migrate dev` and never the seed script (`prisma/seed.ts` is explicitly dev/demo-only and destructive to catalogue/pricing data) against staging or production — neither is wired into any automated path, but don't run them manually against Railway's Postgres either.

Recovery: DB damage → restore from Railway Postgres's backup (confirm your plan includes automated backups — see §J). Bad deploy → redeploy the previous commit via Railway's deployment history. Bad migration → test against staging first; no automated migration-rollback tooling here, by design (CLAUDE.md §6 — not warranted at this scale).

## 11. Staging vs. production

Two separate Railway environments (Railway's own "Environment" feature within one project, or two separate projects — either works; environments are simpler for Shared Variables scoping, §6), differing only in:

- A separate Postgres instance — never shared between staging and production.
- `PAYSTACK_ENV=test` + a `sk_test_...` key in staging (never live keys in staging) — see §9 of the milestone report for the exact webhook URL to register.
- A separate R2 bucket (or a `staging/` key prefix in the same bucket — a separate bucket is simpler to reason about and reset).
- Staging's own `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL` (Railway's generated domain initially, a `staging.<domain>` subdomain later), its own Google OAuth redirect URI, its own Paystack test-mode webhook URL.
- `EMAIL_PROVIDER=resend` can share the same Resend account/domain (Resend has no test/live distinction) — use a clearly-staging `EMAIL_FROM` if you want staging emails visually distinguishable.

Do not point staging at the production database or R2 bucket under any circumstances — there's no environment-isolation code preventing it, this is purely a configuration discipline.

## 12. What this repo cannot do for you

Creating the Railway/Cloudflare/Resend accounts, the Railway project/services/Postgres plugin, custom domains, Paystack test/live-mode credentials, and Google OAuth credentials all require your own external-account authorization. See the milestone report's "External dashboard setup" and "Exact Railway deployment checklist" sections.
