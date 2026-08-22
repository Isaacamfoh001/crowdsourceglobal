# Deploying CrownSourceGlobal on Render (M13)

Practical reference for the intended production topology (`render.yaml`) and every manual step Render/Cloudflare/Resend/Paystack/Google require outside this repo. Nothing in this repo creates external accounts, services, or credentials — see the milestone report for the full manual checklist.

## 1. Runtime architecture

```
Browser
   ↓
Render Web Service (crownsourceglobal) — npm run start, single Next.js process
   ├── Render Managed PostgreSQL (crownsourceglobal-db)
   ├── Cloudflare R2 — private bucket, sourcing/resolution attachments only
   ├── Resend — transactional email
   ├── Paystack — customer payments/refunds, vendor payouts (manual fallback while Starter Business)
   └── Google OAuth — "Continue with Google"

Render Cron Jobs (same repo, three separate services)
   ├── crownsourceglobal-jobs-email          */2 * * * *  (every 2 min)
   ├── crownsourceglobal-jobs-sweep-payments */5 * * * *  (every 5 min)
   └── crownsourceglobal-jobs-sweep-earnings 0 * * * *    (hourly)
```

All Render cron schedules are evaluated in **UTC**.

## 2. Local vs. production storage

`STORAGE_PROVIDER` (`lib/env.ts`) selects the implementation `lib/storage.ts` exports:

- `local` (default) — `LocalDiskStorageProvider`, writes under `LOCAL_STORAGE_DIR` or `~/.crownsourceglobal-dev-storage`. Dev/test only. Does **not** survive a redeploy/restart on Render (or any standard host) — never set this in production.
- `r2` — `R2StorageProvider` (`lib/storage-r2.ts`), Cloudflare R2 via its S3-compatible API. The only production-appropriate option; the app **fails to start** if `NODE_ENV=production` and `STORAGE_PROVIDER` is left at `local` (a deliberate fail-closed guard — see `docs/decisions/0011-production-infrastructure-m13.md`).

Only two things use storage today: custom-sourcing attachments and resolution/dispute evidence — both already private, authenticated, streamed through the app (never a public bucket URL). Product images are unaffected; they're stored as external URLs, not uploaded through the app.

## 3. Cloudflare R2 setup (manual, external)

1. Create (or use an existing) Cloudflare account and enable R2.
2. Create one bucket for CrownSourceGlobal — do **not** enable public access on it.
3. R2 → Manage API Tokens → create a token scoped to only that bucket (read + write + delete), not the account-wide API key.
4. Note the Account ID (R2 → Overview) and the token's Access Key ID / Secret Access Key.
5. Set in Render (see §7): `STORAGE_PROVIDER=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

No bucket lifecycle policy is required at launch — nothing here generates disposable/temp objects.

## 4. Rate limiting — what's protected and how

Two layers, both Postgres-backed (no Redis — see ADR 0011 for why):

- **Better Auth's own routes** (`/sign-in/email`, `/sign-up/email`, `/request-password-reset`, `/reset-password`, `/send-verification-email`) — Better Auth's built-in limiter, `storage: "database"` (`lib/auth.ts`), backed by a `RateLimit` table. Defaults: 3 requests/10s on sign-in/sign-up, 3 requests/60s on password-reset-request/verification-email, per (client IP, path).
- **Custom server actions** — OTP submission (5/5min), MoMo/card payment initiation (10/5min), checkout order creation (10/5min), each per (client IP, customer) — `lib/rate-limit.ts`, backed by an `ActionRateLimit` table.

Both key partly on client IP, resolved via `lib/request-ip.ts` / `lib/auth.ts`'s `ipAddressHeaders`: prefers Cloudflare's `cf-connecting-ip`, falls back to a single-value `x-forwarded-for`, otherwise degrades to one shared bucket rather than trusting a value that could be spoofed. **Read ADR 0011's "Client-IP Trust Question" section before relying on this for anything beyond defense-in-depth** — it documents a real, unresolved ambiguity about exactly how Render forwards these headers, and asks for one manual verification step after first deploying (check real incoming request headers).

Users see "Too many attempts. Please try again shortly." on a 429 — no infrastructure terminology.

## 5. Database

- Managed Postgres (`crownsourceglobal-db` in `render.yaml`) — automated backups and point-in-time recovery are Render-managed, no extra configuration needed here.
- `DATABASE_POOL_MAX` (default 10, `lib/env.ts`) bounds the `pg.Pool` this single web-service process opens (`lib/db.ts`). This app runs as one process, not per-request serverless functions — one bounded pool for the process's lifetime is the right unit to size. Keep it comfortably under the Postgres plan's max connection limit; the three cron jobs use a smaller pool (5, `render.yaml`) since each runs briefly and exits.
- **Migrations run via `preDeployCommand: npm run prisma:migrate:deploy`** (`render.yaml`) — Render runs this once per deploy, on a separate instance, before the new version starts serving traffic. Never `prisma migrate dev` and never the seed script (`prisma/seed.ts` is explicitly dev/demo-only and destructive to catalogue/pricing data) against production — neither is wired into any automated path, but don't run them manually against `crownsourceglobal-db` either.
- Recovery: DB damage → restore from Render's automated backup/point-in-time recovery. Bad deploy → redeploy the previous commit (standard Render rollback). Bad migration → test against staging first (§8); there is no automated migration-rollback tooling here, by design (CLAUDE.md §6 — not warranted at this scale).

## 6. Background jobs — schedule reasoning

| Job | Schedule | Why |
|---|---|---|
| `jobs:email` | every 2 min | Bounded backoff `[1,5,30,120,720]` min on individual email retries — a short poll interval keeps the effective delay close to the job's own intended cadence. |
| `jobs:sweep-payments` | every 5 min | Releases inventory reservations for abandoned Mobile Money payments. Reservations have their own `expiresAt`; 5 minutes keeps stock from being tied up materially longer than that. |
| `jobs:sweep-earnings` | hourly | Only advances a coarse, hours-long hold-period timer (`VENDOR_PAYOUT_HOLD_HOURS`, default 72h) — never time-sensitive to the minute. |

All three scripts are unchanged from before M13 (`scripts/*.ts`) — Render Cron Jobs run them directly, no HTTP wrapper needed. Each already exits 0/1 correctly and is idempotent under overlapping/concurrent invocation (guarded `updateMany` claims) — see the milestone report for the specific confirmation.

## 7. Environment variables to set in the Render dashboard

Everything marked `sync: false` in `render.yaml` must be entered manually per service (Render prompts for these when you apply the Blueprint). No secret values are stored in this repo. See the milestone report's Environment Variables section for the full list and where each value comes from (Cloudflare, Resend, Paystack, Google Cloud Console).

## 8. Setting up staging later

Staging should be a second, independent Render Blueprint instance (or a second set of services under the same account), differing only in:

- A separate Postgres database (`crownsourceglobal-staging-db`), never shared with production.
- `PAYSTACK_ENV=test` + a `sk_test_...` key (never live keys in staging).
- A separate R2 bucket (or a `staging/` key prefix in the same bucket — a separate bucket is simpler to reason about and reset).
- A staging subdomain for `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL`, with its own Google OAuth redirect URI registered and its own Paystack test-mode webhook URL.
- `EMAIL_PROVIDER=resend` is fine to share the same Resend account/domain, since Resend doesn't have a test/live mode distinction the way Paystack does — just use a clearly-staging `EMAIL_FROM` if you want staging emails visually distinguishable.

Do not point staging at the production database or R2 bucket under any circumstances — there's no environment-isolation code preventing it, this is purely a configuration discipline.

## 9. What this repo cannot do for you

Creating the Cloudflare account/bucket/token, the Render account/services/database, DNS, Paystack live-mode activation, Resend domain verification, and Google OAuth production credentials all require your own external-account authorization. See the milestone report's "Manual External Setup Required" section for the complete, grouped checklist.
