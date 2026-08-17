export type FulfilmentStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "DISPATCHED"
  | "DELIVERED"
  | "COMPLETED"
  | "EXCEPTION"
  | "CANCELLED";

export type FulfilmentOrigin = "DOMESTIC_COLLECTION" | "INTERNATIONAL_INBOUND";

export type ShipmentStatus =
  | "CREATED"
  | "COLLECTED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "EXCEPTION";

export type FulfilmentItemView = {
  id: string;
  description: string;
  quantity: number;
};

export type ReceivingLocationSummary = {
  name: string;
  addressLine1: string;
  city: string | null;
  region: string | null;
  country: string;
  contactName: string | null;
  contactPhone: string | null;
};

export type ShipmentView = {
  id: string;
  status: ShipmentStatus;
  carrier: string | null;
  trackingReference: string | null;
  collectionScheduledAt: Date | null;
  collectionNotes: string | null;
  collectedAt: Date | null;
  receivingLocation: ReceivingLocationSummary | null;
  shippedAt: Date | null;
  expectedArrivalAt: Date | null;
  receivedAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  deliveryFailedAt: Date | null;
  deliveryNotes: string | null;
  customerConfirmedReceiptAt: Date | null;
};

export type FulfilmentIssueView = {
  id: string;
  status: "OPEN" | "RESOLVED";
  category: string;
  description: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
};

// --- Vendor-facing --------------------------------------------------------

export type VendorFulfilmentSummary = {
  id: string;
  status: FulfilmentStatus;
  origin: FulfilmentOrigin;
  orderNumber: string;
  createdAt: Date;
  itemCount: number;
  totalQuantity: number;
  hasOpenIssue: boolean;
};

export type VendorFulfilmentDetail = VendorFulfilmentSummary & {
  items: FulfilmentItemView[];
  leadTimeDaysDefault: number | null;
  shipment: ShipmentView | null;
  openIssue: FulfilmentIssueView | null;
};

// --- Admin-facing ----------------------------------------------------------

export type AdminFulfilmentSummary = {
  id: string;
  status: FulfilmentStatus;
  origin: FulfilmentOrigin;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  vendorLeadTimeDays: number | null;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  hasOpenIssue: boolean;
  shipmentStatus: ShipmentStatus | null;
  shipmentShippedAt: Date | null;
  shipmentReceivedAt: Date | null;
};

export type AdminFulfilmentDetail = AdminFulfilmentSummary & {
  items: FulfilmentItemView[];
  shipment: ShipmentView | null;
  openIssue: FulfilmentIssueView | null;
  vendorPickup: {
    addressLine1: string | null;
    contactName: string | null;
    contactPhone: string | null;
    hours: string | null;
    notes: string | null;
  };
  deliveryInfo: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    region: string;
    notes?: string;
  };
};

// --- Customer-facing ---------------------------------------------------

export type CustomerTrackingStep = {
  key: string;
  label: string;
  done: boolean;
  current: boolean;
};

export type CustomerPackageTracking = {
  fulfilmentId: string;
  vendorName: string;
  items: FulfilmentItemView[];
  steps: CustomerTrackingStep[];
  hasIssue: boolean;
  customerConfirmedReceiptAt: Date | null;
};
