"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentSession, requireSession } from "../../modules/identity/policy";
import { identityService } from "../../modules/identity/service";
import { cartService } from "../../modules/cart/service";
import { err, type Result } from "../result";
import { safeRedirect } from "../safe-redirect";

async function requireCustomerProfileId(): Promise<string> {
  const session = await requireSession("/cart");
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  if (!customerProfile) {
    throw new Error("No customer profile for authenticated user — should never happen.");
  }
  return customerProfile.id;
}

/**
 * Cart requires authentication (Cart is CustomerProfile-owned in the
 * approved model — there is no guest cart). An unauthenticated Add to Cart
 * preserves the listing the customer was on, per this milestone's redirect-
 * preservation requirement, rather than dropping them on /account.
 */
export async function addToCartAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const listingId = String(formData.get("listingId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const currentPath = safeRedirect(String(formData.get("currentPath") ?? ""), "/shop");

  const session = await getCurrentSession();
  if (!session) {
    redirect(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
  }

  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  if (!customerProfile) {
    return err("Something went wrong. Please try again.");
  }

  const result = await cartService.addToCart(customerProfile.id, listingId, quantity);
  if (result.ok) {
    revalidatePath("/cart");
  }
  return result;
}

export async function updateCartItemQuantityAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const customerProfileId = await requireCustomerProfileId();
  const cartItemId = String(formData.get("cartItemId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  const result = await cartService.updateQuantity(customerProfileId, cartItemId, quantity);
  revalidatePath("/cart");
  return result;
}

export async function removeCartItemAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const customerProfileId = await requireCustomerProfileId();
  const cartItemId = String(formData.get("cartItemId") ?? "");

  const result = await cartService.removeItem(customerProfileId, cartItemId);
  revalidatePath("/cart");
  return result;
}
