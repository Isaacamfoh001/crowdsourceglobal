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
  vendorFinance: () => "/vendor/portal/finance",
  vendorSettlement: (settlementId: string) => `/vendor/portal/finance/settlements/${settlementId}`,
  vendorExplorePost: (postId: string) => `/vendor/portal/explore/${postId}`,
  /// M22 — the profile is a singleton per vendor, so this always points at
  /// the same management page rather than an id-scoped route.
  vendorBeautyProfessionalProfile: () => "/vendor/portal/beauty-professional",
  vendorServiceRequest: (requestId: string) => `/vendor/portal/beauty-professional/requests/${requestId}`,
  vendorSourcingSolicitation: (solicitationId: string) => `/vendor/portal/sourcing/${solicitationId}`,

  customerOrder: (orderId: string) => `/account/orders/${orderId}`,
  customerQuote: (quotationId: string) => `/account/quotes/${quotationId}`,
  customerSourcing: (requestId: string) => `/account/sourcing/${requestId}`,
  customerMessage: (conversationId: string) => `/account/messages/${conversationId}`,
  customerResolution: (caseId: string) => `/account/resolutions/${caseId}`,
  customerServiceRequest: (requestId: string) => `/account/service-requests/${requestId}`,

  adminVendorApplication: (applicationId: string) => `/admin/vendor-applications/${applicationId}`,
  adminSourcing: (requestId: string) => `/admin/sourcing/${requestId}`,
  adminMessage: (conversationId: string) => `/admin/messages/${conversationId}`,
  adminResolution: (caseId: string) => `/admin/resolutions/${caseId}`,
  adminPayment: (paymentId: string) => `/admin/payments/${paymentId}`,
  adminFinance: () => "/admin/finance",
  adminFinanceVendor: (vendorId: string) => `/admin/finance/vendors/${vendorId}`,
  adminSettlement: (settlementId: string) => `/admin/finance/settlements/${settlementId}`,
  adminTalentApplication: (applicationId: string) => `/admin/talent/${applicationId}`,
  adminExplorePost: (postId: string) => `/admin/explore-posts/${postId}`,
  adminBeautyProfessional: (profileId: string) => `/admin/beauty-professionals/${profileId}`,
  adminServiceRequest: (requestId: string) => `/admin/service-requests/${requestId}`,
};
