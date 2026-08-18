/**
 * Every notification `targetUrl` is built here, from known route shapes —
 * never from a request Host header or client-supplied string (CLAUDE.md's
 * open-redirect concern). All paths are app-relative.
 */
export const notificationLinks = {
  vendorOnboardingStatus: () => "/vendor/onboarding",
  vendorPortal: () => "/vendor/portal",
  vendorListing: (listingId: string) => `/vendor/portal/listings/${listingId}`,
  vendorOrder: (fulfilmentId: string) => `/vendor/portal/orders/${fulfilmentId}`,
  vendorMessage: (conversationId: string) => `/vendor/portal/messages/${conversationId}`,
  vendorResolution: (caseId: string) => `/vendor/portal/resolutions/${caseId}`,

  customerOrder: (orderId: string) => `/account/orders/${orderId}`,
  customerQuote: (quotationId: string) => `/account/quotes/${quotationId}`,
  customerSourcing: (requestId: string) => `/account/sourcing/${requestId}`,
  customerMessage: (conversationId: string) => `/account/messages/${conversationId}`,
  customerResolution: (caseId: string) => `/account/resolutions/${caseId}`,

  adminVendorApplication: (applicationId: string) => `/admin/vendor-applications/${applicationId}`,
  adminSourcing: (requestId: string) => `/admin/sourcing/${requestId}`,
  adminMessage: (conversationId: string) => `/admin/messages/${conversationId}`,
  adminResolution: (caseId: string) => `/admin/resolutions/${caseId}`,
  adminPayment: (paymentId: string) => `/admin/payments/${paymentId}`,
};
