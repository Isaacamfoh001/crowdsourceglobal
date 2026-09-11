export type BeautyServiceInput = {
  name: string;
  description?: string;
  categoryId?: string;
  /** M32.5 — "Other / Not listed" free text; mutually exclusive with categoryId, resolved server-side in beautyServicesService. */
  categoryOther?: string;
  startingPrice?: string;
  currency?: string;
};

export type VendorServiceView = {
  id: string;
  name: string;
  description: string | null;
  startingPrice: string | null;
  currency: string;
  active: boolean;
  category: { id: string; name: string; slug: string };
  categoryOther: string | null;
  createdAt: Date;
  updatedAt: Date;
};
