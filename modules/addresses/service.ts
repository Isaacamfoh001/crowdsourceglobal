import { addressesRepository } from "./repository";
import { ok, err, type Result } from "../../lib/result";
import { GHANA_REGIONS } from "../orders/types";
import type { AddressInput, AddressView } from "./types";

function validate(input: AddressInput): Result<null> {
  if (input.recipientName.trim().length < 2) return err("Enter the recipient's name.");
  if (input.phone.trim().length < 9) return err("Enter a valid phone number.");
  if (input.addressLine1.trim().length < 3) return err("Enter a delivery address.");
  if (input.city.trim().length < 2) return err("Enter a city or town.");
  if (!(GHANA_REGIONS as readonly string[]).includes(input.region)) return err("Select a valid region.");
  return ok(null);
}

export const addressesService = {
  async listForCustomer(customerProfileId: string): Promise<AddressView[]> {
    return addressesRepository.listForCustomer(customerProfileId);
  },

  /** Ownership-scoped — resolves a selected saved address into checkout-ready delivery fields. Never returns another customer's address. */
  async getForCheckout(customerProfileId: string, addressId: string): Promise<AddressView | null> {
    return addressesRepository.findForCustomer(customerProfileId, addressId);
  },

  async create(customerProfileId: string, input: AddressInput): Promise<Result<AddressView>> {
    const check = validate(input);
    if (!check.ok) return check;

    // The very first saved address is automatically the default — a
    // customer with exactly one address should never have to separately
    // mark it as such.
    const existingCount = await addressesRepository.countForCustomer(customerProfileId);
    const created = await addressesRepository.create(customerProfileId, {
      label: input.label?.trim() || null,
      recipientName: input.recipientName.trim(),
      phone: input.phone.trim(),
      addressLine1: input.addressLine1.trim(),
      addressLine2: input.addressLine2?.trim() || null,
      city: input.city.trim(),
      region: input.region,
      isDefault: existingCount === 0,
    });
    return ok(created);
  },

  async update(customerProfileId: string, addressId: string, input: AddressInput): Promise<Result<null>> {
    const check = validate(input);
    if (!check.ok) return check;

    const applied = await addressesRepository.updateForCustomer(customerProfileId, addressId, {
      label: input.label?.trim() || null,
      recipientName: input.recipientName.trim(),
      phone: input.phone.trim(),
      addressLine1: input.addressLine1.trim(),
      addressLine2: input.addressLine2?.trim() || null,
      city: input.city.trim(),
      region: input.region,
    });
    return applied ? ok(null) : err("Address not found.");
  },

  async remove(customerProfileId: string, addressId: string): Promise<Result<null>> {
    const address = await addressesRepository.findForCustomer(customerProfileId, addressId);
    if (!address) return err("Address not found.");

    const deleted = await addressesRepository.deleteForCustomer(customerProfileId, addressId);
    if (!deleted) return err("Address not found.");

    // Deleting the default leaves the customer with no default until a
    // safe fallback is chosen automatically — never silently leave every
    // remaining address non-default with no way to reach one at checkout
    // without an explicit re-selection.
    if (address.isDefault) {
      await addressesRepository.promoteMostRecentAsDefault(customerProfileId);
    }
    return ok(null);
  },

  async setDefault(customerProfileId: string, addressId: string): Promise<Result<null>> {
    const applied = await addressesRepository.setDefaultTransactional(customerProfileId, addressId);
    return applied ? ok(null) : err("Address not found.");
  },
};
