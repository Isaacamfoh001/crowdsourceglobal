import { emailProvider } from "./email-provider";
import { renderEmail } from "./email-templates";

/**
 * Authentication emails — verification and password reset — stay direct
 * and synchronous rather than routed through modules/notifications' durable
 * Notification + EmailDeliveryJob machinery (M7 brief §43's explicit
 * exception). Reasoning: the user is actively waiting on these in the same
 * flow they just triggered (a sign-up/reset form); there is no in-app
 * notification center to show them in first (the account often isn't
 * accessible yet); and Better Auth's own hooks (lib/auth.ts) are already
 * the natural, minimal call site. Every other transactional email in the
 * app goes through notificationsService.notify() instead — see
 * modules/notifications/service.ts.
 */
export async function sendVerificationEmail(params: { to: string; url: string }): Promise<void> {
  const { html, text } = renderEmail({
    title: "Verify your CrownSourceGlobal account",
    intro: "Confirm your email address to finish setting up your account.",
    ctaLabel: "Verify email",
    ctaAbsoluteUrl: params.url,
  });
  await emailProvider.send({ to: params.to, subject: "Verify your CrownSourceGlobal account", html, text });
}

export async function sendPasswordResetEmail(params: { to: string; url: string }): Promise<void> {
  const { html, text } = renderEmail({
    title: "Reset your CrownSourceGlobal password",
    intro: "We received a request to reset your password.",
    bodyLines: ["If you didn't request this, you can safely ignore this email."],
    ctaLabel: "Reset password",
    ctaAbsoluteUrl: params.url,
  });
  await emailProvider.send({ to: params.to, subject: "Reset your CrownSourceGlobal password", html, text });
}
