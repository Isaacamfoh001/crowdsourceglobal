import { prisma } from "../../lib/db";

const cartItemListingSelect = {
  id: true,
  title: true,
  basePrice: true,
  currency: true,
  moq: true,
  maxOq: true,
  availableQuantity: true,
  availabilityStatus: true,
  approvalStatus: true,
  listingStatus: true,
  images: true,
  category: { select: { slug: true } },
  vendor: { select: { id: true, companyName: true, storefrontSlug: true } },
} as const;

const cartWithItemsSelect = {
  id: true,
  items: {
    select: {
      id: true,
      quantity: true,
      listingId: true,
      listing: { select: cartItemListingSelect },
    },
    orderBy: { addedAt: "asc" as const },
  },
} as const;

export type CartItemRow = NonNullable<
  Awaited<ReturnType<typeof cartRepository.findActiveCartByCustomerId>>
>["items"][number];

export const cartRepository = {
  findActiveCartByCustomerId(customerProfileId: string) {
    return prisma.cart.findFirst({
      where: { customerProfileId, status: "ACTIVE" },
      select: cartWithItemsSelect,
    });
  },

  async getOrCreateActiveCartId(customerProfileId: string): Promise<string> {
    const existing = await prisma.cart.findFirst({
      where: { customerProfileId, status: "ACTIVE" },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
    const created = await prisma.cart.create({
      data: { customerProfileId },
      select: { id: true },
    });
    return created.id;
  },

  async getItemCount(customerProfileId: string): Promise<number> {
    const cart = await prisma.cart.findFirst({
      where: { customerProfileId, status: "ACTIVE" },
      select: { items: { select: { quantity: true } } },
    });
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  },

  findCartItemForCustomer(cartItemId: string, customerProfileId: string) {
    return prisma.cartItem.findFirst({
      where: { id: cartItemId, cart: { customerProfileId } },
      select: { id: true, cartId: true, listingId: true, quantity: true },
    });
  },

  findExistingItem(cartId: string, listingId: string) {
    return prisma.cartItem.findUnique({
      where: { cartId_listingId: { cartId, listingId } },
      select: { id: true, quantity: true },
    });
  },

  createItem(cartId: string, listingId: string, quantity: number) {
    return prisma.cartItem.create({ data: { cartId, listingId, quantity } });
  },

  setItemQuantity(cartItemId: string, quantity: number) {
    return prisma.cartItem.update({ where: { id: cartItemId }, data: { quantity } });
  },

  deleteItem(cartItemId: string) {
    return prisma.cartItem.delete({ where: { id: cartItemId } });
  },

  findListingForCartValidation(listingId: string) {
    return prisma.vendorListing.findUnique({
      where: { id: listingId },
      select: cartItemListingSelect,
    });
  },

  markConverted(cartId: string) {
    return prisma.cart.update({ where: { id: cartId }, data: { status: "CONVERTED" } });
  },
};
