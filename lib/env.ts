import { z } from "zod";

/**
 * Server-side environment validation. Fails fast at startup rather than
 * surfacing confusing errors deep inside Better Auth/Prisma later.
 *
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are intentionally optional here:
 * the app must still run (email/password fully works) when Google OAuth
 * credentials haven't been supplied yet. lib/auth.ts only registers the
 * Google provider when both are present.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.url(),
  /**
   * How many days an instant quotation stays acceptable after issuance
   * (docs/workflows/workflows.md Workflow Q). PROJECT.md does not mandate an
   * exact figure, so this is a documented, configurable V1 default rather
   * than a number buried inside modules/quotation/service.ts.
   */
  QUOTE_VALIDITY_DAYS: z.coerce.number().int().positive().default(7),
  /**
   * M7 email delivery. "console" (default) logs to the server console —
   * safe for dev/test with zero configuration. "resend" requires
   * RESEND_API_KEY and EMAIL_FROM; lib/email-provider.ts fails fast at
   * import time if selected without them, rather than surfacing a
   * confusing failure deep inside a background job later.
   */
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  /**
   * M8 admin operations dashboard. These are operational defaults for
   * staff-attention ageing, NOT contractual SLAs — PROJECT.md does not
   * mandate exact figures, so they're documented, configurable V1 values
   * (same reasoning as QUOTE_VALIDITY_DAYS above), centralized in
   * modules/operations/policy.ts rather than scattered as magic numbers.
   */
  OPS_VENDOR_APPLICATION_WARNING_HOURS: z.coerce.number().positive().default(24),
  OPS_LISTING_REVIEW_WARNING_HOURS: z.coerce.number().positive().default(48),
  OPS_MESSAGE_RESPONSE_WARNING_HOURS: z.coerce.number().positive().default(4),
  OPS_SOURCING_STALE_HOURS: z.coerce.number().positive().default(24),
  OPS_FULFILMENT_PREPARING_WARNING_HOURS: z.coerce.number().positive().default(48),
  OPS_SOURCING_DEADLINE_WARNING_DAYS: z.coerce.number().positive().default(3),
  /**
   * M9 post-purchase resolution — same "operational default, not a
   * contractual SLA" reasoning as the M8 OPS_* vars above.
   */
  OPS_RESOLUTION_UNASSIGNED_WARNING_HOURS: z.coerce.number().positive().default(12),
  OPS_RESOLUTION_REVIEW_WARNING_HOURS: z.coerce.number().positive().default(24),
  OPS_RETURN_INSPECTION_WARNING_HOURS: z.coerce.number().positive().default(48),
  /**
   * Payment provider selection. "mock" (default) — deterministic,
   * synchronous, dev/test only; production must never be able to fabricate
   * a payment success. "paystack" (M10A.2) — the primary real provider,
   * Ghana Mobile Money via Paystack's Charge API. "moolre" (M10A) —
   * experimental/deferred as of M10A.2, kept selectable for
   * development/experimental testing only, never routed to in production.
   */
  PAYMENT_PROVIDER: z.enum(["mock", "moolre", "paystack"]).default("mock"),
  /**
   * Selects Moolre's base URL. Deliberately explicit and independent of
   * NODE_ENV — a production deploy must never accidentally hit sandbox (or
   * vice versa) just because NODE_ENV happens to be set a certain way.
   */
  MOOLRE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  /** Required only when PAYMENT_PROVIDER=moolre. */
  MOOLRE_API_USER: z.string().optional(),
  /** Moolre's "public" transactional key (X-API-PUBKEY) — distinct from the account-management private key below. */
  MOOLRE_API_PUBKEY: z.string().optional(),
  /** Moolre account-management private key (X-API-KEY) — only needed for one-time account setup, not runtime payment calls. */
  MOOLRE_API_KEY: z.string().optional(),
  MOOLRE_ACCOUNT_NUMBER: z.string().optional(),
  /**
   * M10A.2 — Paystack. Deliberately explicit and independent of NODE_ENV,
   * same reasoning as MOOLRE_ENV above — a production deploy must never
   * accidentally run against test-mode credentials, or vice versa.
   */
  PAYSTACK_ENV: z.enum(["test", "live"]).default("test"),
  /** Required only when PAYMENT_PROVIDER=paystack. Server-only — never exposed via NEXT_PUBLIC_*. */
  PAYSTACK_SECRET_KEY: z.string().optional(),
  /** Only needed if the chosen integration surface requires it client-side; the MoMo Charge API flow implemented here does not. */
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  /**
   * M11 Vendor Finance. How long after a Fulfilment reaches DELIVERED
   * before its VendorEarning may become ELIGIBLE for settlement — an
   * operational buffer for post-delivery issues to surface, NOT a
   * contractual SLA (PROJECT.md does not mandate an exact figure; same
   * "documented, configurable V1 default" reasoning as QUOTE_VALIDITY_DAYS/
   * OPS_* above). Set to 0 to disable the hold window entirely (useful for
   * manual acceptance testing).
   */
  VENDOR_PAYOUT_HOLD_HOURS: z.coerce.number().nonnegative().default(72),
  /**
   * M11 admin-dashboard attention thresholds — same "operational default,
   * not a contractual SLA" reasoning as the OPS_* vars above.
   */
  OPS_FINANCE_ELIGIBLE_UNSETTLED_WARNING_HOURS: z.coerce.number().positive().default(168),
  OPS_FINANCE_SETTLEMENT_APPROVED_WARNING_HOURS: z.coerce.number().positive().default(72),
  /**
   * M13 file storage. "local" (default) — LocalDiskStorageProvider, dev/test
   * only. "r2" — Cloudflare R2 via its S3-compatible API, requires the R2_*
   * variables below. Production must never be able to fall back to local
   * disk (see the fail-closed check below) — see lib/storage.ts.
   */
  STORAGE_PROVIDER: z.enum(["local", "r2"]).default("local"),
  /** Required only when STORAGE_PROVIDER=r2. Used to build the R2 S3-compatible endpoint. */
  R2_ACCOUNT_ID: z.string().optional(),
  /** Required only when STORAGE_PROVIDER=r2. R2 API token credentials — server-only. */
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  /** Required only when STORAGE_PROVIDER=r2. The private bucket sourcing/resolution attachments are written to. */
  R2_BUCKET_NAME: z.string().optional(),
  /**
   * M13 (deployment target adapted to Railway in M13.2 — see ADR 0012).
   * Bounds the Postgres connection pool `@prisma/adapter-pg` opens
   * (lib/db.ts). This is a single always-on web-service process, not a
   * per-request serverless function, so one bounded pool for the process's
   * lifetime is sufficient — not a per-request or per-instance concern.
   * Keep this comfortably under the managed Postgres plan's max connection
   * limit (leave headroom for `prisma migrate deploy`, `prisma studio`,
   * and any manual psql session).
   */
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
});

function loadEnv() {
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env["DATABASE_URL"],
    BETTER_AUTH_URL: process.env["BETTER_AUTH_URL"],
    BETTER_AUTH_SECRET: process.env["BETTER_AUTH_SECRET"],
    GOOGLE_CLIENT_ID: process.env["GOOGLE_CLIENT_ID"] || undefined,
    GOOGLE_CLIENT_SECRET: process.env["GOOGLE_CLIENT_SECRET"] || undefined,
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
    QUOTE_VALIDITY_DAYS: process.env["QUOTE_VALIDITY_DAYS"] || undefined,
    EMAIL_PROVIDER: process.env["EMAIL_PROVIDER"] || undefined,
    EMAIL_FROM: process.env["EMAIL_FROM"] || undefined,
    RESEND_API_KEY: process.env["RESEND_API_KEY"] || undefined,
    OPS_VENDOR_APPLICATION_WARNING_HOURS: process.env["OPS_VENDOR_APPLICATION_WARNING_HOURS"] || undefined,
    OPS_LISTING_REVIEW_WARNING_HOURS: process.env["OPS_LISTING_REVIEW_WARNING_HOURS"] || undefined,
    OPS_MESSAGE_RESPONSE_WARNING_HOURS: process.env["OPS_MESSAGE_RESPONSE_WARNING_HOURS"] || undefined,
    OPS_SOURCING_STALE_HOURS: process.env["OPS_SOURCING_STALE_HOURS"] || undefined,
    OPS_FULFILMENT_PREPARING_WARNING_HOURS: process.env["OPS_FULFILMENT_PREPARING_WARNING_HOURS"] || undefined,
    OPS_SOURCING_DEADLINE_WARNING_DAYS: process.env["OPS_SOURCING_DEADLINE_WARNING_DAYS"] || undefined,
    OPS_RESOLUTION_UNASSIGNED_WARNING_HOURS: process.env["OPS_RESOLUTION_UNASSIGNED_WARNING_HOURS"] || undefined,
    OPS_RESOLUTION_REVIEW_WARNING_HOURS: process.env["OPS_RESOLUTION_REVIEW_WARNING_HOURS"] || undefined,
    OPS_RETURN_INSPECTION_WARNING_HOURS: process.env["OPS_RETURN_INSPECTION_WARNING_HOURS"] || undefined,
    PAYMENT_PROVIDER: process.env["PAYMENT_PROVIDER"] || undefined,
    MOOLRE_ENV: process.env["MOOLRE_ENV"] || undefined,
    MOOLRE_API_USER: process.env["MOOLRE_API_USER"] || undefined,
    MOOLRE_API_PUBKEY: process.env["MOOLRE_API_PUBKEY"] || undefined,
    MOOLRE_API_KEY: process.env["MOOLRE_API_KEY"] || undefined,
    MOOLRE_ACCOUNT_NUMBER: process.env["MOOLRE_ACCOUNT_NUMBER"] || undefined,
    PAYSTACK_ENV: process.env["PAYSTACK_ENV"] || undefined,
    PAYSTACK_SECRET_KEY: process.env["PAYSTACK_SECRET_KEY"] || undefined,
    PAYSTACK_PUBLIC_KEY: process.env["PAYSTACK_PUBLIC_KEY"] || undefined,
    VENDOR_PAYOUT_HOLD_HOURS: process.env["VENDOR_PAYOUT_HOLD_HOURS"] || undefined,
    OPS_FINANCE_ELIGIBLE_UNSETTLED_WARNING_HOURS: process.env["OPS_FINANCE_ELIGIBLE_UNSETTLED_WARNING_HOURS"] || undefined,
    OPS_FINANCE_SETTLEMENT_APPROVED_WARNING_HOURS: process.env["OPS_FINANCE_SETTLEMENT_APPROVED_WARNING_HOURS"] || undefined,
    STORAGE_PROVIDER: process.env["STORAGE_PROVIDER"] || undefined,
    R2_ACCOUNT_ID: process.env["R2_ACCOUNT_ID"] || undefined,
    R2_ACCESS_KEY_ID: process.env["R2_ACCESS_KEY_ID"] || undefined,
    R2_SECRET_ACCESS_KEY: process.env["R2_SECRET_ACCESS_KEY"] || undefined,
    R2_BUCKET_NAME: process.env["R2_BUCKET_NAME"] || undefined,
    DATABASE_POOL_MAX: process.env["DATABASE_POOL_MAX"] || undefined,
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${message}`);
  }

  return parsed.data;
}

export const env = loadEnv();

/**
 * Fail closed: a running production server must never be able to "confirm"
 * a payment via the deterministic mock provider. Sandbox/dev/test freely
 * use mock. Skipped during `next build`'s page-data collection
 * (NEXT_PHASE=phase-production-build) — NODE_ENV is "production" then too,
 * but no request is ever served, and the real deploy environment's actual
 * PAYMENT_PROVIDER may not be known/available at build time.
 */
if (
  process.env["NODE_ENV"] === "production" &&
  process.env["NEXT_PHASE"] !== "phase-production-build" &&
  env.PAYMENT_PROVIDER === "mock"
) {
  throw new Error(
    "PAYMENT_PROVIDER=mock is not permitted when NODE_ENV=production. Set PAYMENT_PROVIDER=paystack with valid Paystack credentials.",
  );
}

if (env.PAYMENT_PROVIDER === "moolre" && (!env.MOOLRE_API_USER || !env.MOOLRE_API_PUBKEY || !env.MOOLRE_ACCOUNT_NUMBER)) {
  throw new Error(
    "PAYMENT_PROVIDER=moolre requires MOOLRE_API_USER, MOOLRE_API_PUBKEY, and MOOLRE_ACCOUNT_NUMBER to be set.",
  );
}

if (env.PAYMENT_PROVIDER === "paystack" && !env.PAYSTACK_SECRET_KEY) {
  throw new Error("PAYMENT_PROVIDER=paystack requires PAYSTACK_SECRET_KEY to be set.");
}

if (
  env.STORAGE_PROVIDER === "r2" &&
  (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME)
) {
  throw new Error(
    "STORAGE_PROVIDER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME to be set.",
  );
}

/**
 * Fail closed: a running production server must never silently write
 * sourcing/resolution attachments to local disk, which does not survive a
 * redeploy/restart on any standard host (M13 audit finding). Skipped during
 * `next build` for the same reason as the PAYMENT_PROVIDER=mock guard above.
 */
if (
  process.env["NODE_ENV"] === "production" &&
  process.env["NEXT_PHASE"] !== "phase-production-build" &&
  env.STORAGE_PROVIDER === "local"
) {
  throw new Error("STORAGE_PROVIDER=local is not permitted when NODE_ENV=production. Set STORAGE_PROVIDER=r2 with valid R2 credentials.");
}

/**
 * Defense in depth: Paystack's own key-prefix convention (sk_test_.../
 * sk_live_...) must match the explicitly-configured PAYSTACK_ENV — never
 * inferred from NODE_ENV alone. A live key in test mode (or vice versa) is
 * exactly the kind of accidental misconfiguration that should fail loudly
 * at startup rather than silently charge/verify against the wrong mode.
 */
if (
  process.env["NEXT_PHASE"] !== "phase-production-build" &&
  env.PAYMENT_PROVIDER === "paystack" &&
  env.PAYSTACK_SECRET_KEY
) {
  const isLiveKey = env.PAYSTACK_SECRET_KEY.startsWith("sk_live_");
  const isTestKey = env.PAYSTACK_SECRET_KEY.startsWith("sk_test_");
  if (env.PAYSTACK_ENV === "live" && !isLiveKey) {
    throw new Error("PAYSTACK_ENV=live requires a live Paystack secret key (sk_live_...). A test key was supplied.");
  }
  if (env.PAYSTACK_ENV === "test" && !isTestKey && isLiveKey) {
    throw new Error("PAYSTACK_ENV=test must not use a live Paystack secret key (sk_live_...).");
  }
}

export const googleOAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);
