"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client-side Better Auth SDK. Used from Client Components for
 * sign-in/sign-up/sign-out/session forms. Never put secrets here — this
 * code ships to the browser.
 */
export const authClient = createAuthClient({
  baseURL: process.env["NEXT_PUBLIC_APP_URL"],
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
} = authClient;
