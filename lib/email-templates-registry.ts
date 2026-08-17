import { renderEmail, type TemplateContent } from "./email-templates";

/**
 * templateKey -> content builder, one per NotificationType (24 total,
 * matching modules/notifications/types.ts exactly — 1:1 traceability from
 * event to email, mirroring the individual lib/email.ts functions this
 * registry replaces). `data` is trusted: it only ever originates from this
 * codebase's own `notificationsService.notify()` calls, never client input.
 */
const registry: Record<string, (data: Record<string, unknown>) => TemplateContent> = {
  "vendor-application-submitted": (d) => ({
    title: "We've received your vendor application",
    intro: `Your CrownSourceGlobal vendor application for "${d["storeName"]}" has been submitted.`,
    bodyLines: ["Our team will review it and let you know the outcome."],
    ctaLabel: "Check application status",
    ctaPath: "/vendor/onboarding",
  }),
  "vendor-application-approved": (d) => ({
    title: "Your vendor application was approved",
    intro: `Your CrownSourceGlobal vendor application for "${d["storeName"]}" has been approved.`,
    bodyLines: ["You can now access your Vendor Portal and start preparing listings for review."],
    ctaLabel: "Open Vendor Portal",
    ctaPath: "/vendor/portal",
  }),
  "vendor-application-changes-requested": (d) => ({
    title: "Changes requested on your vendor application",
    intro: `CrownSourceGlobal has requested changes to your vendor application: ${d["reason"]}`,
    bodyLines: ["Update and resubmit your application to continue."],
    ctaLabel: "Resume application",
    ctaPath: "/vendor/onboarding",
  }),
  "vendor-application-rejected": (d) => ({
    title: "Your vendor application was not approved",
    intro: `Your CrownSourceGlobal vendor application was not approved: ${d["reason"]}`,
    ctaLabel: "View details",
    ctaPath: "/vendor/onboarding",
  }),
  "listing-approved": (d) => ({
    title: "Your listing is now live",
    intro: `Your listing "${d["listingTitle"]}" is now live on CrownSourceGlobal.`,
    bodyLines: ["Manage it any time from your Vendor Portal."],
    ctaLabel: "Manage listings",
    ctaPath: "/vendor/portal/listings",
  }),
  "listing-changes-requested": (d) => ({
    title: "Changes requested on your listing",
    intro: `CrownSourceGlobal requested changes to "${d["listingTitle"]}": ${d["reason"]}`,
    bodyLines: ["Edit and resubmit it from your Vendor Portal."],
    ctaLabel: "Edit listing",
    ctaPath: `/vendor/portal/listings/${d["listingId"]}`,
  }),
  "listing-rejected": (d) => ({
    title: "Your listing was not approved",
    intro: `Your listing "${d["listingTitle"]}" was not approved: ${d["reason"]}`,
    ctaLabel: "View listings",
    ctaPath: "/vendor/portal/listings",
  }),
  "order-confirmed": (d) => ({
    title: "Your order is confirmed",
    intro: `Your CrownSourceGlobal order ${d["orderNumber"]} is confirmed and vendors have been notified.`,
    bodyLines: ["Track its progress any time from your account."],
    ctaLabel: "View order",
    ctaPath: `/account/orders/${d["orderId"]}`,
  }),
  "vendor-new-order": (d) => ({
    title: "You have a new order to prepare",
    intro: `You have a new order to prepare: ${d["orderNumber"]}.`,
    bodyLines: ["Review the items and get started in your Vendor Portal."],
    ctaLabel: "View order",
    ctaPath: `/vendor/portal/orders/${d["fulfilmentId"]}`,
  }),
  "collection-scheduled": (d) => ({
    title: "Collection has been scheduled",
    intro: `Collection for order ${d["orderNumber"]} has been scheduled: ${d["scheduledAt"]}.`,
    ctaLabel: "View order",
    ctaPath: `/vendor/portal/orders/${d["fulfilmentId"]}`,
  }),
  "package-collected": (d) => ({
    title: "Your order is on its way",
    intro: `Your order ${d["orderNumber"]} has been collected and is on its way.`,
    ctaLabel: "Track order",
    ctaPath: `/account/orders/${d["orderId"]}`,
  }),
  "out-for-delivery": (d) => ({
    title: "Your order is out for delivery",
    intro: `Your order ${d["orderNumber"]} is out for delivery today.`,
    ctaLabel: "Track order",
    ctaPath: `/account/orders/${d["orderId"]}`,
  }),
  delivered: (d) => ({
    title: "Your order has been delivered",
    intro: `Your order ${d["orderNumber"]} has been delivered.`,
    ctaLabel: "View order",
    ctaPath: `/account/orders/${d["orderId"]}`,
  }),
  "delivery-issue": (d) => ({
    title: "There was a problem delivering your order",
    intro: `There was a problem delivering order ${d["orderNumber"]}: ${d["notes"]}`,
    bodyLines: ["CrownSourceGlobal is following up."],
    ctaLabel: "View order",
    ctaPath: `/account/orders/${d["orderId"]}`,
  }),
  "fulfilment-issue-resolved": (d) => ({
    title: "Order issue resolved",
    intro: `The issue on order ${d["orderNumber"]} has been resolved: ${d["resolutionNotes"]}`,
    bodyLines: ["You can continue preparing it in your Vendor Portal."],
    ctaLabel: "View order",
    ctaPath: `/vendor/portal/orders/${d["fulfilmentId"]}`,
  }),
  "quote-issued": (d) => ({
    title: "Your quotation is ready",
    intro: `Your CrownSourceGlobal quotation ${d["reference"]} is ready: ${d["currency"]} ${Number(d["total"]).toFixed(2)}.`,
    bodyLines: [`Valid until ${d["expiresAt"]}.`],
    ctaLabel: "View quotation",
    ctaPath: `/account/quotes/${d["quotationId"]}`,
  }),
  "sourcing-request-submitted": (d) => ({
    title: "We've received your sourcing request",
    intro: `We've received your sourcing request ${d["requestNumber"]}.`,
    bodyLines: ["Our sourcing team will review your requirements and contact you through CrownSourceGlobal if we need more information."],
    ctaLabel: "View request",
    ctaPath: `/account/sourcing/${d["requestId"]}`,
  }),
  "sourcing-clarification-needed": (d) => ({
    title: "We need more information from you",
    intro: `CrownSourceGlobal needs more information about your sourcing request ${d["requestNumber"]}.`,
    ctaLabel: "Reply now",
    ctaPath: `/account/sourcing/${d["requestId"]}`,
  }),
  "sourcing-quote-ready": (d) => ({
    title: "Your sourcing quotation is ready",
    intro: `Your quotation for sourcing request ${d["requestNumber"]} is ready: ${d["reference"]}.`,
    ctaLabel: "View quotation",
    ctaPath: `/account/sourcing/${d["requestId"]}`,
  }),
  "sourcing-unable-to-source": (d) => ({
    title: "We couldn't source this request",
    intro: `We're unable to source your request ${d["requestNumber"]}: ${d["reason"]}`,
    ctaLabel: "View request",
    ctaPath: `/account/sourcing/${d["requestId"]}`,
  }),
  "staff-reply": (d) => ({
    title: "CrownSourceGlobal replied to your message",
    intro: "You have a new reply from CrownSourceGlobal.",
    ctaLabel: "View message",
    ctaPath: `/account/messages/${d["conversationId"]}`,
  }),
  "vendor-staff-reply": (d) => ({
    title: "CrownSourceGlobal replied to your message",
    intro: "You have a new reply from CrownSourceGlobal.",
    ctaLabel: "View message",
    ctaPath: `/vendor/portal/messages/${d["conversationId"]}`,
  }),
  "admin-new-vendor-application": (d) => ({
    title: "New vendor application",
    intro: `A new vendor application from "${d["companyName"]}" needs review.`,
    ctaLabel: "Review application",
    ctaPath: `/admin/vendor-applications/${d["applicationId"]}`,
  }),
  "admin-new-sourcing-request": (d) => ({
    title: "New sourcing request",
    intro: `New custom sourcing request ${d["requestNumber"]}: "${d["title"]}".`,
    ctaLabel: "Review request",
    ctaPath: `/admin/sourcing/${d["requestId"]}`,
  }),
  "admin-new-message": (d) => ({
    title: "New message needs a reply",
    intro: `${d["counterpartyName"]} sent a new message.`,
    ctaLabel: "Open inbox",
    ctaPath: `/admin/messages/${d["conversationId"]}`,
  }),
};

/** Subject is NOT re-derived here — the caller (modules/notifications) sets and stores its own subject at enqueue time (EmailDeliveryJob.subject); this only renders the body. */
export function renderRegisteredEmail(templateKey: string, data: Record<string, unknown>): { html: string; text: string } {
  const builder = registry[templateKey];
  if (!builder) {
    throw new Error(`Unknown email template key: ${templateKey}`);
  }
  return renderEmail(builder(data));
}
