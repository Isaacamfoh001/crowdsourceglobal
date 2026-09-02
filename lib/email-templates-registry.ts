import { renderEmail, type TemplateContent } from "./email-templates";

/**
 * templateKey -> content builder, one per NotificationType (see
 * modules/notifications/types.ts for the current count) — 1:1 traceability from
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
  "explore-post-approved": () => ({
    title: "Your Explore post is now live",
    intro: "Your beauty work post is now visible to CrownSourceGlobal customers on Explore.",
    ctaLabel: "View your posts",
    ctaPath: "/vendor/portal/explore",
  }),
  "explore-post-changes-requested": (d) => ({
    title: "Changes requested on your Explore post",
    intro: `CrownSourceGlobal requested changes to your Explore post: ${d["reason"]}`,
    bodyLines: ["Edit and resubmit it from your Vendor Portal."],
    ctaLabel: "View your posts",
    ctaPath: "/vendor/portal/explore",
  }),
  "explore-post-rejected": (d) => ({
    title: "Your Explore post was not approved",
    intro: `Your Explore post was not approved: ${d["reason"]}`,
    ctaLabel: "View your posts",
    ctaPath: "/vendor/portal/explore",
  }),
  "beauty-professional-approved": () => ({
    title: "You're live on Beauty Services",
    intro: "Your Beauty Professional profile is now visible to CrownSourceGlobal customers.",
    ctaLabel: "Manage your profile",
    ctaPath: "/vendor/portal/beauty-professional",
  }),
  "beauty-professional-changes-requested": (d) => ({
    title: "Changes requested on your Beauty Professional profile",
    intro: `CrownSourceGlobal requested changes to your profile: ${d["reason"]}`,
    bodyLines: ["Update and resubmit it from your Vendor Portal."],
    ctaLabel: "Update profile",
    ctaPath: "/vendor/portal/beauty-professional",
  }),
  "beauty-professional-rejected": (d) => ({
    title: "Your Beauty Professional profile was not approved",
    intro: `Your profile was not approved: ${d["reason"]}`,
    ctaLabel: "View details",
    ctaPath: "/vendor/portal/beauty-professional",
  }),
  "service-request-submitted": (d) => ({
    title: "New service request",
    intro: `A customer requested ${d["serviceName"]}.`,
    bodyLines: ["Review and respond from your Vendor Portal."],
    ctaLabel: "View requests",
    ctaPath: "/vendor/portal/beauty-professional/requests",
  }),
  "service-request-accepted": () => ({
    title: "Your service request was accepted",
    intro: "Great news — the professional accepted your service request.",
    bodyLines: ["CrownSourceGlobal will help coordinate the details."],
    ctaLabel: "View your requests",
    ctaPath: "/account/service-requests",
  }),
  "service-request-declined": (d) => ({
    title: "Your service request was declined",
    intro: d["reason"] ? `The professional was unable to take your request: ${d["reason"]}` : "The professional was unable to take your request.",
    bodyLines: ["You can browse other Beauty Professionals from the CrownSourceGlobal app any time."],
    ctaLabel: "View your requests",
    ctaPath: "/account/service-requests",
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
  "vendor-sourcing-solicitation-received": (d) => ({
    title: "New sourcing request from CrownSourceGlobal",
    intro: `CrownSourceGlobal is asking whether you can fulfil a sourcing request for ${d["quantity"]} ${d["quantityUnit"] ?? "units"}.`,
    bodyLines: ["Review the details and let us know if you can fulfil it from your Vendor Portal."],
    ctaLabel: "View request",
    ctaPath: `/vendor/portal/sourcing/${d["solicitationId"]}`,
  }),
  "admin-sourcing-solicitation-responded": (d) => ({
    title: "A factory responded to your sourcing request",
    intro: `${d["vendorName"]} responded to sourcing request ${d["requestNumber"]}.`,
    ctaLabel: "Compare responses",
    ctaPath: `/admin/sourcing/${d["requestId"]}`,
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
  "resolution-case-received": (d) => ({
    title: "We've received your report",
    intro: `We've received your report on order ${d["orderNumber"]} (case ${d["caseNumber"]}).`,
    bodyLines: ["Our team will review it and get back to you through CrownSourceGlobal."],
    ctaLabel: "View case",
    ctaPath: `/account/resolutions/${d["caseId"]}`,
  }),
  "resolution-clarification-needed": (d) => ({
    title: "We need more information from you",
    intro: `CrownSourceGlobal needs more information about case ${d["caseNumber"]}.`,
    ctaLabel: "Reply now",
    ctaPath: `/account/resolutions/${d["caseId"]}`,
  }),
  "resolution-approved": (d) => ({
    title: "Your case has been reviewed",
    intro: `We've reviewed case ${d["caseNumber"]} for order ${d["orderNumber"]}: ${d["decisionReason"]}`,
    ctaLabel: "View case",
    ctaPath: `/account/resolutions/${d["caseId"]}`,
  }),
  "return-approved": (d) => ({
    title: "Your return has been approved",
    intro: `A return has been approved for case ${d["caseNumber"]}.`,
    bodyLines: ["Check your case page for return instructions."],
    ctaLabel: "View return instructions",
    ctaPath: `/account/resolutions/${d["caseId"]}`,
  }),
  "refund-approved": (d) => ({
    title: "Your refund has been approved",
    intro: `A refund of ${d["currency"]} ${Number(d["amount"]).toFixed(2)} has been approved for case ${d["caseNumber"]}.`,
    ctaLabel: "View case",
    ctaPath: `/account/resolutions/${d["caseId"]}`,
  }),
  "refund-completed": (d) => ({
    title: "Your refund is complete",
    intro: `Your refund of ${d["currency"]} ${Number(d["amount"]).toFixed(2)} for case ${d["caseNumber"]} has been completed.`,
    ctaLabel: "View case",
    ctaPath: `/account/resolutions/${d["caseId"]}`,
  }),
  "replacement-created": (d) => ({
    title: "Your replacement is being prepared",
    intro: `A replacement is being prepared for case ${d["caseNumber"]}.`,
    bodyLines: ["Track it just like a normal order from your account."],
    ctaLabel: "Track replacement",
    ctaPath: `/account/orders/${d["orderId"]}`,
  }),
  "resolution-case-resolved": (d) => ({
    title: "Your case is resolved",
    intro: `Case ${d["caseNumber"]} for order ${d["orderNumber"]} is now resolved.`,
    ctaLabel: "View case",
    ctaPath: `/account/resolutions/${d["caseId"]}`,
  }),
  "resolution-vendor-response-needed": (d) => ({
    title: "CrownSourceGlobal needs your response",
    intro: `CrownSourceGlobal needs your input on an order issue (case ${d["caseNumber"]}).`,
    ctaLabel: "Respond now",
    ctaPath: `/vendor/portal/resolutions/${d["caseId"]}`,
  }),
  "resolution-vendor-case-update": (d) => ({
    title: "Update on an order issue",
    intro: `There's an update on case ${d["caseNumber"]} affecting one of your orders.`,
    ctaLabel: "View case",
    ctaPath: `/vendor/portal/resolutions/${d["caseId"]}`,
  }),
  "admin-new-resolution-case": (d) => ({
    title: "New resolution case",
    intro: `New case ${d["caseNumber"]}: ${d["issueType"]} on order ${d["orderNumber"]}.`,
    ctaLabel: "Review case",
    ctaPath: `/admin/resolutions/${d["caseId"]}`,
  }),
  "admin-refund-failed": (d) => ({
    title: "Refund failed",
    intro: `A refund for case ${d["caseNumber"]} failed to process and needs attention.`,
    ctaLabel: "Review refund",
    ctaPath: `/admin/resolutions/${d["caseId"]}`,
  }),
  "payment-failed": (d) => ({
    title: "Your payment could not be completed",
    intro: `We couldn't complete your payment for order ${d["orderNumber"]}.`,
    bodyLines: ["You can try again from your order page."],
    ctaLabel: "View order",
    ctaPath: `/account/orders/${d["orderId"]}`,
  }),
  "admin-payment-requires-attention": (d) => ({
    title: "Payment requires attention",
    intro: `Payment ${d["reference"]} for order ${d["orderNumber"]} requires manual review.`,
    ctaLabel: "Review payment",
    ctaPath: `/admin/payments/${d["paymentId"]}`,
  }),
  "vendor-earning-on-hold": (d) => ({
    title: "An earning has been placed on hold",
    intro: `An earning from order ${d["orderNumber"]} has been placed on hold: ${d["reasonSafe"]}`,
    bodyLines: ["It will resume once the related issue is resolved."],
    ctaLabel: "View Finance",
    ctaPath: "/vendor/portal/finance",
  }),
  "vendor-settlement-approved": (d) => ({
    title: "Your settlement has been approved",
    intro: `Settlement ${d["settlementNumber"]} of ${d["currency"]} ${Number(d["netAmount"]).toFixed(2)} has been approved and is being prepared for payout.`,
    ctaLabel: "View settlement",
    ctaPath: `/vendor/portal/finance/settlements/${d["settlementId"]}`,
  }),
  "vendor-settlement-paid": (d) => ({
    title: "Your settlement has been paid",
    intro: `Your CrownSourceGlobal settlement ${d["settlementNumber"]} of ${d["currency"]} ${Number(d["netAmount"]).toFixed(2)} has been paid.`,
    ctaLabel: "View settlement",
    ctaPath: `/vendor/portal/finance/settlements/${d["settlementId"]}`,
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
