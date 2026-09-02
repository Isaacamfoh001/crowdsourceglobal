import { serializeMoney } from "../response";
import type { CartView } from "../../../modules/cart/types";

/**
 * Mobile cart DTO (M25). Mirrors modules/cart/types.ts's CartView exactly —
 * money fields become the shared `{ amount, currency }` shape (see
 * ListingSummaryDTO's `price` on the mobile client) instead of bare
 * numbers, everything else passes through unchanged. No authoritative
 * total is ever added here beyond what cartService.getCartView already
 * computed — checkout independently revalidates regardless.
 */
export function toCartViewDTO(cart: CartView) {
  return {
    cartId: cart.cartId,
    itemCount: cart.itemCount,
    currency: cart.currency,
    subtotal: serializeMoney(cart.subtotal, cart.currency),
    vendorGroups: cart.vendorGroups.map((group) => ({
      vendor: group.vendor,
      subtotal: serializeMoney(group.subtotal, cart.currency),
      lines: group.lines.map((line) => ({
        id: line.id,
        listingId: line.listingId,
        title: line.title,
        categorySlug: line.categorySlug,
        primaryImage: line.primaryImage,
        quantity: line.quantity,
        moq: line.moq,
        maxOq: line.maxOq,
        availableQuantity: line.availableQuantity,
        availabilityStatus: line.availabilityStatus,
        unitPrice: serializeMoney(line.unitPrice, line.currency),
        lineTotal: serializeMoney(line.lineTotal, line.currency),
        hasBulkPricing: line.hasBulkPricing,
      })),
    })),
  };
}
