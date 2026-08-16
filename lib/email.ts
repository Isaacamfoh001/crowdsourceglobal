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

/**
 * M4 fulfilment/delivery notifications — same dev-console adapter pattern.
 * Deliberately narrow: only the meaningful, actionable events (per CLAUDE.md
 * "avoid notification spam") — not every internal Shipment status tick.
 */

export async function sendNewOrderToVendorEmail(params: { to: string; orderNumber: string }): Promise<void> {
  console.log(
    `[email:vendor-new-order] to=${params.to}\n` +
      `  You have a new order to prepare: ${params.orderNumber}.\n` +
      `  Review it in your Vendor Portal at /vendor/portal/orders.`,
  );
}

export async function sendCollectionScheduledEmail(params: {
  to: string;
  orderNumber: string;
  scheduledAt: string;
}): Promise<void> {
  console.log(
    `[email:vendor-collection-scheduled] to=${params.to}\n` +
      `  Collection for order ${params.orderNumber} has been scheduled: ${params.scheduledAt}.`,
  );
}

export async function sendFulfilmentIssueResolvedEmail(params: {
  to: string;
  orderNumber: string;
  resolutionNotes: string;
}): Promise<void> {
  console.log(
    `[email:vendor-issue-resolved] to=${params.to}\n` +
      `  The issue on order ${params.orderNumber} has been resolved: ${params.resolutionNotes}\n` +
      `  You can continue preparing it in your Vendor Portal.`,
  );
}

export async function sendPackageCollectedEmail(params: { to: string; orderNumber: string }): Promise<void> {
  console.log(
    `[email:customer-package-collected] to=${params.to}\n` +
      `  Your order ${params.orderNumber} has been collected and is on its way.`,
  );
}

export async function sendOutForDeliveryEmail(params: { to: string; orderNumber: string }): Promise<void> {
  console.log(
    `[email:customer-out-for-delivery] to=${params.to}\n` +
      `  Your order ${params.orderNumber} is out for delivery today.`,
  );
}

export async function sendDeliveredEmail(params: { to: string; orderNumber: string }): Promise<void> {
  console.log(
    `[email:customer-delivered] to=${params.to}\n  Your order ${params.orderNumber} has been delivered.`,
  );
}

export async function sendDeliveryIssueEmail(params: { to: string; orderNumber: string; notes: string }): Promise<void> {
  console.log(
    `[email:customer-delivery-issue] to=${params.to}\n` +
      `  There was a problem delivering order ${params.orderNumber}: ${params.notes}\n` +
      `  CrownSourceGlobal is following up.`,
  );
}

/**
 * M5 instant-quotation notification — same dev-console adapter pattern.
 * Dispatched post-commit (see modules/quotation/service.ts) — an email
 * provider outage must never roll back or block an already-issued quote.
 */
export async function sendQuoteIssuedEmail(params: {
  to: string;
  reference: string;
  total: number;
  currency: string;
  expiresAt: string;
}): Promise<void> {
  console.log(
    `[email:quote-issued] to=${params.to}\n` +
      `  Your CrownSourceGlobal quotation ${params.reference} is ready: ${params.currency} ${params.total.toFixed(2)}.\n` +
      `  Valid until ${params.expiresAt}. View it at /account/quotes.`,
  );
}
