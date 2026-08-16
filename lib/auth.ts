import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { env, googleOAuthConfigured } from "./env";
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

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, url });
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

  plugins: [nextCookies()],
});
