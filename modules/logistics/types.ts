/** Admin-only — a ReceivingLocation is never exposed on any public/customer/vendor DTO. */
export type ReceivingLocationView = {
  id: string;
  name: string;
  type: string | null;
  active: boolean;
  country: string;
  region: string | null;
  city: string | null;
  addressLine1: string;
  contactName: string | null;
  contactPhone: string | null;
  createdAt: Date;
};

export type ReceivingLocationInput = {
  name: string;
  type?: string;
  country: string;
  region?: string;
  city?: string;
  addressLine1: string;
  contactName?: string;
  contactPhone?: string;
};
