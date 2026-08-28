export type CreateServiceRequestInput = {
  professionalId: string;
  serviceId: string;
  preferredDate: string;
  preferredTimeNote?: string;
  locationMode: "PROVIDER_LOCATION" | "CUSTOMER_LOCATION";
  locationDetails?: string;
  notes?: string;
  quantity?: number;
};

export type ServiceRequestParty = { id: string; name: string };

/** Shared shape across customer/provider/admin views — never includes provider or customer private contact fields (CrownSource remains the intermediary). */
export type ServiceRequestView = {
  id: string;
  status: string;
  preferredDate: Date;
  preferredTimeNote: string | null;
  locationMode: string;
  locationDetails: string | null;
  notes: string | null;
  quantity: number;
  referenceImage: string | null;
  declineReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  professional: ServiceRequestParty;
  service: { id: string; name: string };
  customer: ServiceRequestParty;
};
