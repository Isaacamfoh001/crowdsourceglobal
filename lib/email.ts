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

/**
 * Vendor application / listing moderation notifications — same dev-console
 * adapter pattern as above. Callers (modules/vendor-applications,
 * modules/vendor-listings) trigger these AFTER their moderation transaction
 * has already committed, never from inside it — an email provider outage
 * must never roll back or block an already-valid approval/rejection.
 * Bodies are deliberately limited to what's safe to show the applicant/
 * vendor: no internal admin review notes, no other applicants' data.
 */

export async function sendVendorApplicationApprovedEmail(params: { to: string; storeName: string }): Promise<void> {
  console.log(
    `[email:vendor-application-approved] to=${params.to}\n` +
      `  Your CrownSourceGlobal vendor application for "${params.storeName}" has been approved.\n` +
      `  Next step: visit your Vendor Portal at /vendor/portal to start listing products.`,
  );
}

export async function sendVendorApplicationChangesRequestedEmail(params: {
  to: string;
  reason: string;
}): Promise<void> {
  console.log(
    `[email:vendor-application-changes-requested] to=${params.to}\n` +
      `  CrownSourceGlobal has requested changes to your vendor application: ${params.reason}\n` +
      `  Resume your application at /vendor/onboarding.`,
  );
}

export async function sendVendorApplicationRejectedEmail(params: { to: string; reason: string }): Promise<void> {
  console.log(
    `[email:vendor-application-rejected] to=${params.to}\n` +
      `  Your CrownSourceGlobal vendor application was not approved: ${params.reason}`,
  );
}

export async function sendListingApprovedEmail(params: { to: string; listingTitle: string }): Promise<void> {
  console.log(
    `[email:listing-approved] to=${params.to}\n` +
      `  Your listing "${params.listingTitle}" is now live on CrownSourceGlobal.\n` +
      `  Manage it from your Vendor Portal at /vendor/portal/listings.`,
  );
}

export async function sendListingChangesRequestedEmail(params: {
  to: string;
  listingTitle: string;
  reason: string;
}): Promise<void> {
  console.log(
    `[email:listing-changes-requested] to=${params.to}\n` +
      `  CrownSourceGlobal requested changes to "${params.listingTitle}": ${params.reason}\n` +
      `  Edit and resubmit it from your Vendor Portal at /vendor/portal/listings.`,
  );
}

export async function sendListingRejectedEmail(params: {
  to: string;
  listingTitle: string;
  reason: string;
}): Promise<void> {
  console.log(
    `[email:listing-rejected] to=${params.to}\n` +
      `  Your listing "${params.listingTitle}" was not approved: ${params.reason}`,
  );
}
