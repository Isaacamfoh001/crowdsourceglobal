export type BeautyServiceInput = {
  name: string;
  description?: string;
  categoryId: string;
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
  createdAt: Date;
  updatedAt: Date;
};
