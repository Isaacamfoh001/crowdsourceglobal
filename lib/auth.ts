import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { prisma } from "./db";
import { env, googleOAuthConfigured, additionalTrustedOrigins } from "./env";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { identityService } from "../modules/identity/service";

/**
 * Better Auth owns authentication only: credentials, sessions, email
 * verification, password reset, Google OAuth, and secure account linking.
 * CrownSourceGlobal owns everything downstream of "who is this user" —
 * see docs/decisions/0002-authentication.md.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  // BETTER_AUTH_URL is always implicitly trusted; this adds any extra
  // origins from BETTER_AUTH_TRUSTED_ORIGINS (lib/env.ts) — e.g. the mobile
  // app's `crownsourceglobal://` scheme, required below by the expo()
  // plugin to append the session cookie on a native Google OAuth redirect.
  // M25.1 finding: this env var was previously set/documented (see the
  // expo() plugin comment below) but never actually passed to betterAuth()
  // — a no-op. An empty array here is itself a no-op, so this is safe to
  // pass unconditionally.
  trustedOrigins: additionalTrustedOrigins,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, url });
    },
    // M25.1.2 finding: with requireEmailVerification: true, Better Auth's
    // built-in anti-enumeration protection makes sign-up against an
    // already-registered email return a synthetic 200 (see
    // shouldReturnGenericDuplicateResponse in
    // node_modules/better-auth/dist/api/routes/sign-up.mjs) and never calls
    // emailVerification.sendVerificationEmail below — by design, so a
    // sign-up attempt can't be used to probe which emails are registered.
    // Without this hook, that path was also silent in server logs, which is
    // indistinguishable from a genuinely broken verification pipeline. This
    // hook is purely observational: Better Auth discards its return value
    // and builds the synthetic response independently either way, so it
    // changes no security behavior or client-visible response.
    onExistingUserSignUp: async ({ user }) => {
      console.log(
        `[email] sign-up attempted for already-registered ${user.email} — no verification email sent ` +
          `(anti-enumeration); use the sign-in page's "Resend verification email" action instead.`,
      );
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token, url: betterAuthUrl }) => {
      // Point at our own /verify-email page (rather than Better Auth's
      // bare API url) so verification gets a proper loading/success/error
      // UI instead of a raw JSON response. Better Auth's own generated
      // `url` already embeds whatever callbackURL was passed to
      // signUp.email() as a query param — forward it through as `redirect`
      // so a customer who registered mid-checkout returns there after
      // verifying, instead of always landing on /account.
      const callbackURL = new URL(betterAuthUrl).searchParams.get("callbackURL");
      const redirectParam =
        callbackURL && callbackURL !== "/" ? `&redirect=${encodeURIComponent(callbackURL)}` : "";
      const url = `${env.NEXT_PUBLIC_APP_URL}/verify-email?token=${encodeURIComponent(token)}${redirectParam}`;
      await sendVerificationEmail({ to: user.email, url });
    },
  },

  // Google is only registered once real credentials are supplied — see
  // .env.example. Email/password auth is fully usable without it.
  socialProviders: googleOAuthConfigured
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : undefined,

  account: {
    accountLinking: {
      enabled: true,
      // Google's verified email is trusted as proof of ownership for
      // implicit linking; `requireLocalEmailVerified` (Better Auth default:
      // true) additionally requires the pre-existing local row to already
      // be verified before an implicit link is allowed — together these
      // are exactly the secure-linking policy in ADR 0002. Never set
      // `allowDifferentEmails: true` (Better Auth's own docs flag this as
      // an account-takeover risk).
      trustedProviders: ["google", "email-password"],
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await identityService.ensureCustomerProfile(user);
        },
      },
    },
  },

  /**
   * M13. Better Auth already ships sensible built-in limits on exactly the
   * routes that matter here — sign-in/sign-up (3 requests/10s) and
   * request-password-reset/send-verification-email (3 requests/60s), all
   * per (client IP, path) — see node_modules/better-auth's
   * getDefaultSpecialRules(). No customRules override needed; those
   * defaults are conservative without being disruptive to a legitimate
   * user. What DOES need explicit configuration:
   * - storage: "database" — the default is in-memory, which silently
   *   resets every limit to zero on every restart/redeploy of this
   *   single-process web service (misleading protection, exactly what the
   *   M13 audit brief warned against). Uses the RateLimit table
   *   (prisma/schema.prisma) via the same Prisma adapter already
   *   configured above — no new infrastructure.
   * - advanced.ipAddress.ipAddressHeaders (M13.2 — re-verified for Railway,
   *   see lib/request-ip.ts's comment and
   *   docs/decisions/0012-railway-deployment-m13-2.md): Railway's own edge
   *   proxy is reported to strip/replace any client-supplied
   *   X-Forwarded-For rather than merely appending to it (unlike Render,
   *   M13's original target — see ADR 0011's now-superseded analysis), so
   *   its leftmost entry is trustworthy on Railway without a
   *   trustedProxies CIDR list. x-real-ip (Railway's own single-value
   *   header) and cf-connecting-ip (relevant only if a custom domain is
   *   later proxied through Cloudflare) are checked first regardless,
   *   since both are strictly safer when present and a no-op when absent.
   */
  rateLimit: {
    enabled: true,
    storage: "database",
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"],
    },
  },

  /**
   * M18.1 — mobile/native auth foundation. `bearer()` lets a client that
   * cannot hold a browser cookie jar (a React Native/Expo app) authenticate
   * with `Authorization: Bearer <token>` instead: on sign-in/sign-up it
   * echoes the session token as a `set-auth-token` response header (in
   * addition to the normal Set-Cookie), and on every later request it
   * transparently rewrites a valid bearer token back into the same
   * session-cookie header `auth.api.getSession()` already reads — so
   * `modules/identity/policy.ts`'s `getCurrentSession()` (and everything
   * built on it, including every `/api/v1` route) needs no changes at all
   * to support either transport. Purely additive: the `before` hook only
   * activates when an `Authorization` header is present, so existing
   * browser/cookie requests (which never send one) are entirely
   * unaffected. Must come before `nextCookies()`, which Better Auth
   * requires to be the last plugin in the array.
   *
   * M20.2 — `expo()` (`@better-auth/expo`, version-locked to `1.6.30` to
   * match `better-auth`'s own pin above, per the M20.1 finding in
   * docs/architecture/overview.md) is the server half of the actual
   * `@better-auth/expo` mobile integration. In practice the installed
   * Expo client plugin (`expoClient`, mobile repo's `src/lib/auth/client.ts`)
   * does NOT use the `bearer()` token path above — it emulates a cookie jar
   * on-device (captures `Set-Cookie` on each response, replays it as a
   * `Cookie` header on each request), so `getCurrentSession()` sees an
   * ordinary cookie-authenticated request from a native client exactly as
   * it would from a browser. What `expo()` actually adds: (1) rewrites the
   * synthetic `expo-origin` header the client sends into a real `origin`
   * header so Better Auth's origin/CSRF check doesn't reject a native
   * request that has no browser Origin; (2) in `NODE_ENV=development`,
   * treats Expo Go's `exp://` scheme as trusted automatically; (3) appends
   * the session cookie as a `?cookie=` query param on the final OAuth
   * redirect back to the app's custom scheme — required for native Google
   * sign-in — but only for a scheme already present in `trustedOrigins`
   * (this app's `crownsourceglobal://`, via `BETTER_AUTH_TRUSTED_ORIGINS`;
   * see docs/architecture/overview.md's "Mobile API Foundation" section).
   * `bearer()` stays registered for any future non-cookie native caller;
   * `expo()` must come before `nextCookies()`, same rule as `bearer()`.
   */
  plugins: [bearer(), expo(), nextCookies()],
});
