"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "../../modules/identity/policy";
import { identityService } from "../../modules/identity/service";
import { addressesService } from "../../modules/addresses/service";
import { err, ok, type Result } from "../result";
import type { AddressInput } from "../../modules/addresses/types";

async function currentCustomerProfileId(): Promise<Result<string>> {
  const session = await requireSession("/account/addresses");
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  if (!customerProfile) return err("Something went wrong. Please try again.");
  return ok(customerProfile.id);
}

function parseAddressForm(formData: FormData): AddressInput {
  return {
    label: String(formData.get("label") ?? "") || undefined,
    recipientName: String(formData.get("recipientName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    addressLine1: String(formData.get("addressLine1") ?? ""),
    addressLine2: String(formData.get("addressLine2") ?? "") || undefined,
    city: String(formData.get("city") ?? ""),
    region: String(formData.get("region") ?? ""),
  };
}

export async function createAddressAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const customerProfileId = await currentCustomerProfileId();
  if (!customerProfileId.ok) return customerProfileId;

  const result = await addressesService.create(customerProfileId.value, parseAddressForm(formData));
  if (!result.ok) return result;
  revalidatePath("/account/addresses");
  return ok(null);
}

export async function updateAddressAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const customerProfileId = await currentCustomerProfileId();
  if (!customerProfileId.ok) return customerProfileId;

  const addressId = String(formData.get("addressId") ?? "");
  const result = await addressesService.update(customerProfileId.value, addressId, parseAddressForm(formData));
  if (!result.ok) return result;
  revalidatePath("/account/addresses");
  return ok(null);
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const customerProfileId = await currentCustomerProfileId();
  if (!customerProfileId.ok) return;
  const addressId = String(formData.get("addressId") ?? "");
  await addressesService.remove(customerProfileId.value, addressId);
  revalidatePath("/account/addresses");
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const customerProfileId = await currentCustomerProfileId();
  if (!customerProfileId.ok) return;
  const addressId = String(formData.get("addressId") ?? "");
  await addressesService.setDefault(customerProfileId.value, addressId);
  revalidatePath("/account/addresses");
}
