import { cartRepository } from "./repository";
import { pricingService } from "../pricing/service";
import { resolveUnitPrice } from "../pricing/resolveUnitPrice";
import { ok, err, type Result } from "../../lib/result";
import type { CartLineView, CartVendorGroup, CartView } from "./types";

function isPubliclyPurchasable(listing: { approvalStatus: string; listingStatus: string }) {
  return listing.approvalStatus === "APPROVED" && listing.listingStatus === "ACTIVE";
}

async function validateQuantity(
  listingId: string,
  quantity: number,
): Promise<Result<Awaited<ReturnType<typeof cartRepository.findListingForCartValidation>>>> {
  const listing = await cartRepository.findListingForCartValidation(listingId);

  if (!listing || !isPubliclyPurchasable(listing)) {
    return err("This listing is no longer available.");
  }
  if (listing.availabilityStatus === "OUT_OF_STOCK") {
    return err(`${listing.title} is currently out of stock.`);
  }
  if (quantity < listing.moq) {
    return err(`Minimum order quantity for ${listing.title} is ${listing.moq}.`);
  }
  if (listing.maxOq && quantity > listing.maxOq) {
    return err(`Maximum order quantity for ${listing.title} is ${listing.maxOq}.`);
  }
  if (quantity > listing.availableQuantity) {
    return err(`Only ${listing.availableQuantity} of ${listing.title} available right now.`);
  }

  return ok(listing);
}

export const cartService = {
  async addToCart(
    customerProfileId: string,
    listingId: string,
    requestedQuantity: number,
  ): Promise<Result<null>> {
    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      return err("Enter a valid quantity.");
    }

    const cartId = await cartRepository.getOrCreateActiveCartId(customerProfileId);
    const existing = await cartRepository.findExistingItem(cartId, listingId);
    const newQuantity = (existing?.quantity ?? 0) + requestedQuantity;

    const validated = await validateQuantity(listingId, newQuantity);
    if (!validated.ok) {
      return validated;
    }

    if (existing) {
      await cartRepository.setItemQuantity(existing.id, newQuantity);
    } else {
      await cartRepository.createItem(cartId, listingId, requestedQuantity);
    }

    return ok(null);
  },

  async updateQuantity(
    customerProfileId: string,
    cartItemId: string,
    quantity: number,
  ): Promise<Result<null>> {
    const item = await cartRepository.findCartItemForCustomer(cartItemId, customerProfileId);
    if (!item) {
      return err("Item not found in your cart.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      await cartRepository.deleteItem(item.id);
      return ok(null);
    }

    const validated = await validateQuantity(item.listingId, quantity);
    if (!validated.ok) {
      return validated;
    }

    await cartRepository.setItemQuantity(item.id, quantity);
    return ok(null);
  },

  async removeItem(customerProfileId: string, cartItemId: string): Promise<Result<null>> {
    const item = await cartRepository.findCartItemForCustomer(cartItemId, customerProfileId);
    if (!item) {
      return err("Item not found in your cart.");
    }
    await cartRepository.deleteItem(item.id);
    return ok(null);
  },

  getItemCount(customerProfileId: string): Promise<number> {
    return cartRepository.getItemCount(customerProfileId);
  },

  async getCartView(customerProfileId: string): Promise<CartView> {
    const cart = await cartRepository.findActiveCartByCustomerId(customerProfileId);

    if (!cart || cart.items.length === 0) {
      return { cartId: cart?.id ?? null, itemCount: 0, vendorGroups: [], subtotal: 0, currency: "GHS" };
    }

    const listingIds = cart.items.map((item) => item.listingId);
    const tiersByListing = await pricingService.getBulkTiersForListings(listingIds);

    const lines: CartLineView[] = cart.items.map((item) => {
      const listing = item.listing;
      const tiers = tiersByListing.get(item.listingId) ?? [];
      const unitPrice = resolveUnitPrice(listing.basePrice.toNumber(), tiers, item.quantity);

      return {
        id: item.id,
        listingId: item.listingId,
        title: listing.title,
        categorySlug: listing.category.slug,
        quantity: item.quantity,
        moq: listing.moq,
        maxOq: listing.maxOq,
        availableQuantity: listing.availableQuantity,
        availabilityStatus: listing.availabilityStatus,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        currency: listing.currency,
        hasBulkPricing: tiers.length > 0,
        vendor: listing.vendor,
      };
    });

    const groupsByVendor = new Map<string, CartVendorGroup>();
    for (const line of lines) {
      const existing = groupsByVendor.get(line.vendor.id);
      if (existing) {
        existing.lines.push(line);
        existing.subtotal += line.lineTotal;
      } else {
        groupsByVendor.set(line.vendor.id, {
          vendor: line.vendor,
          lines: [line],
          subtotal: line.lineTotal,
        });
      }
    }

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

    return {
      cartId: cart.id,
      itemCount,
      vendorGroups: [...groupsByVendor.values()],
      subtotal,
      currency: lines[0]?.currency ?? "GHS",
    };
  },
};
