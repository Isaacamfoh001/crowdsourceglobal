import { prisma } from "../../lib/db";

const addressSelect = {
  id: true,
  label: true,
  recipientName: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  region: true,
  isDefault: true,
} as const;

export const addressesRepository = {
  listForCustomer(customerProfileId: string) {
    return prisma.customerAddress.findMany({
      where: { customerProfileId },
      select: addressSelect,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  /** Ownership-scoped — returns null for another customer's address, never leaking existence. */
  findForCustomer(customerProfileId: string, addressId: string) {
    return prisma.customerAddress.findFirst({ where: { id: addressId, customerProfileId }, select: addressSelect });
  },

  countForCustomer(customerProfileId: string) {
    return prisma.customerAddress.count({ where: { customerProfileId } });
  },

  create(customerProfileId: string, input: { label: string | null; recipientName: string; phone: string; addressLine1: string; addressLine2: string | null; city: string; region: string; isDefault: boolean }) {
    return prisma.customerAddress.create({ data: { customerProfileId, ...input }, select: addressSelect });
  },

  /** Ownership-scoped update — returns null if the address doesn't belong to this customer. */
  async updateForCustomer(
    customerProfileId: string,
    addressId: string,
    input: { label: string | null; recipientName: string; phone: string; addressLine1: string; addressLine2: string | null; city: string; region: string },
  ) {
    const result = await prisma.customerAddress.updateMany({ where: { id: addressId, customerProfileId }, data: input });
    return result.count === 1;
  },

  async deleteForCustomer(customerProfileId: string, addressId: string) {
    const result = await prisma.customerAddress.deleteMany({ where: { id: addressId, customerProfileId } });
    return result.count === 1;
  },

  /** Unsets any existing default and sets the given address as default, atomically — ownership-scoped throughout. */
  async setDefaultTransactional(customerProfileId: string, addressId: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const target = await tx.customerAddress.findFirst({ where: { id: addressId, customerProfileId }, select: { id: true } });
      if (!target) return false;
      await tx.customerAddress.updateMany({ where: { customerProfileId, isDefault: true }, data: { isDefault: false } });
      await tx.customerAddress.update({ where: { id: addressId }, data: { isDefault: true } });
      return true;
    });
  },

  /** Promotes the most recently created remaining address to default — used when the current default is deleted. */
  async promoteMostRecentAsDefault(customerProfileId: string): Promise<void> {
    const next = await prisma.customerAddress.findFirst({ where: { customerProfileId }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (next) await prisma.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
  },
};
