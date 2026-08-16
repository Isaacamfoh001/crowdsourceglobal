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

export const googleOAuthConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);
