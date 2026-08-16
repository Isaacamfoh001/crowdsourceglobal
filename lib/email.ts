/**
 * M0 email adapter: logs to the server console instead of sending real
 * email. Swap this for a real provider (Resend/Postmark — see
 * docs/architecture/overview.md) without touching lib/auth.ts, which only
 * depends on this module's function signatures.
 */
export async function sendVerificationEmail(params: {
  to: string;
  url: string;
}): Promise<void> {
  console.log(
    `[email:verification] to=${params.to}\n  Verify your CrownSourceGlobal account: ${params.url}`,
  );
}

export async function sendPasswordResetEmail(params: {
  to: string;
  url: string;
}): Promise<void> {
  console.log(
    `[email:password-reset] to=${params.to}\n  Reset your CrownSourceGlobal password: ${params.url}`,
  );
}
