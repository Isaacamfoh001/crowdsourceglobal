export type NotificationType =
  | "VENDOR_APPLICATION_SUBMITTED"
  | "VENDOR_APPLICATION_APPROVED"
  | "VENDOR_APPLICATION_CHANGES_REQUESTED"
  | "VENDOR_APPLICATION_REJECTED"
  | "LISTING_APPROVED"
  | "LISTING_CHANGES_REQUESTED"
  | "LISTING_REJECTED"
  | "ORDER_CONFIRMED"
  | "VENDOR_NEW_ORDER"
  | "COLLECTION_SCHEDULED"
  | "PACKAGE_COLLECTED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_ISSUE"
  | "FULFILMENT_ISSUE_RESOLVED"
  | "QUOTE_ISSUED"
  | "SOURCING_REQUEST_SUBMITTED"
  | "SOURCING_CLARIFICATION_NEEDED"
  | "SOURCING_QUOTE_READY"
  | "SOURCING_UNABLE_TO_SOURCE"
  | "STAFF_REPLY"
  | "VENDOR_STAFF_REPLY"
  | "ADMIN_NEW_VENDOR_APPLICATION"
  | "ADMIN_NEW_SOURCING_REQUEST"
  | "ADMIN_NEW_MESSAGE"
  | "RESOLUTION_CASE_RECEIVED"
  | "RESOLUTION_CLARIFICATION_NEEDED"
  | "RESOLUTION_APPROVED"
  | "RETURN_APPROVED"
  | "REFUND_APPROVED"
  | "REFUND_COMPLETED"
  | "REPLACEMENT_CREATED"
  | "RESOLUTION_CASE_RESOLVED"
  | "RESOLUTION_VENDOR_RESPONSE_NEEDED"
  | "RESOLUTION_VENDOR_CASE_UPDATE"
  | "ADMIN_NEW_RESOLUTION_CASE"
  | "ADMIN_REFUND_FAILED"
  | "PAYMENT_FAILED"
  | "ADMIN_PAYMENT_REQUIRES_ATTENTION"
  | "VENDOR_EARNING_ON_HOLD"
  | "VENDOR_SETTLEMENT_APPROVED"
  | "VENDOR_SETTLEMENT_PAID"
  | "ADMIN_NEW_TALENT_APPLICATION"
  | "EXPLORE_POST_APPROVED"
  | "EXPLORE_POST_CHANGES_REQUESTED"
  | "EXPLORE_POST_REJECTED"
  | "BEAUTY_PROFESSIONAL_APPROVED"
  | "BEAUTY_PROFESSIONAL_CHANGES_REQUESTED"
  | "BEAUTY_PROFESSIONAL_REJECTED"
  | "SERVICE_REQUEST_SUBMITTED"
  | "SERVICE_REQUEST_ACCEPTED"
  | "SERVICE_REQUEST_DECLINED"
  | "VENDOR_SOURCING_SOLICITATION_RECEIVED"
  | "ADMIN_SOURCING_SOLICITATION_RESPONDED";

export type NotificationCategory = "ORDERS_DELIVERY" | "QUOTATIONS_SOURCING" | "MESSAGES";

export type EmailPayload = {
  to: string;
  subject: string;
  templateKey: string;
  templateData: Record<string, unknown>;
};

export type NotifyInput = {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  targetUrl: string;
  /** Dedup key, scoped per-recipient — see schema.prisma's Notification doc comment. */
  eventKey: string;
  /** Omit entirely for a purely in-app event; present to also queue an email (subject to preference gating unless REQUIRED). */
  email?: EmailPayload;
};

export type NotificationView = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  targetUrl: string;
  readAt: Date | null;
  createdAt: Date;
};

export type PreferencesView = {
  ordersDeliveryEmail: boolean;
  quotationsSourcingEmail: boolean;
  messagesEmail: boolean;
};

export type PreferencesInput = Partial<PreferencesView>;
