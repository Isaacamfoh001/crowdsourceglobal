import { prisma } from "../../lib/db";
import { paginationSkip } from "../../lib/pagination";

const draftListingSelect = {
  id: true,
  title: true,
  basePrice: true,
  currency: true,
  moq: true,
  maxOq: true,
  approvalStatus: true,
  listingStatus: true,
  vendorId: true,
  vendor: { select: { id: true, companyName: true, storefrontSlug: true } },
  vendorCostRule: { select: { vendorSupplyCost: true } },
} as const;

const quotationItemSelect = {
  id: true,
  description: true,
  quantity: true,
  unitPrice: true,
  lineTotal: true,
  vendor: { select: { companyName: true, storefrontSlug: true } },
} as const;

const quotationDetailSelect = {
  id: true,
  reference: true,
  origin: true,
  status: true,
  currency: true,
  subtotal: true,
  total: true,
  issuedAt: true,
  expiresAt: true,
  acceptedAt: true,
  customerProfileId: true,
  order: { select: { id: true } },
  items: { select: quotationItemSelect, orderBy: { id: "asc" as const } },
} as const;

/** Admin views include the private vendor-payable snapshot per item. */
const adminQuotationItemSelect = {
  ...quotationItemSelect,
  vendorPayableBasis: true,
} as const;

export const quotationRepository = {
  /** Fresh read for the Quote Builder preview — never the pricing source of truth for issuance itself. */
  findListingsForDraft(listingIds: string[]) {
    return prisma.vendorListing.findMany({
      where: { id: { in: listingIds } },
      select: draftListingSelect,
    });
  },

  createIssuedQuotation(params: {
    reference: string;
    customerProfileId: string;
    currency: string;
    subtotal: number;
    total: number;
    expiresAt: Date;
    items: {
      listingId: string;
      vendorId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      vendorPayableBasis: number;
      lineTotal: number;
    }[];
  }) {
    return prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          reference: params.reference,
          customerProfileId: params.customerProfileId,
          currency: params.currency,
          subtotal: params.subtotal,
          total: params.total,
          expiresAt: params.expiresAt,
        },
      });
      await tx.quotationItem.createMany({
        data: params.items.map((item) => ({ ...item, quotationId: quotation.id })),
      });
      return quotation;
    });
  },

  findDetailForCustomer(id: string, customerProfileId: string) {
    return prisma.quotation.findFirst({
      where: { id, customerProfileId },
      select: quotationDetailSelect,
    });
  },

  async listForCustomer(customerProfileId: string, page: number, pageSize: number) {
    const where = { customerProfileId };
    const [rows, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        select: {
          id: true,
          reference: true,
          status: true,
          total: true,
          currency: true,
          issuedAt: true,
          expiresAt: true,
          items: { select: { id: true } },
        },
        orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.quotation.count({ where }),
    ]);
    return { rows, total };
  },

  /** Ownership-scoped, used by ordersService.createOrderFromQuotation before/inside the acceptance transaction. */
  findWithItemsForAcceptance(id: string, customerProfileId: string) {
    return prisma.quotation.findFirst({
      where: { id, customerProfileId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        subtotal: true,
        total: true,
        currency: true,
        sourcingRequestId: true,
        items: {
          select: {
            listingId: true,
            vendorId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            vendorPayableBasis: true,
            lineTotal: true,
          },
        },
      },
    });
  },

  /** Best-effort — acceptance's own expiry check is the actual authority, this just self-heals the stored value. */
  markExpiredIfDue(id: string) {
    return prisma.quotation.updateMany({
      where: { id, status: "ISSUED", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
  },

  findOrderIdByQuotationId(quotationId: string) {
    return prisma.order.findUnique({ where: { originQuotationId: quotationId }, select: { id: true } });
  },

  /** Lines only — feeds "Get Updated Quote" (a fresh draft seeded from an expired quote's items). */
  findLinesForReissue(id: string, customerProfileId: string) {
    return prisma.quotation.findFirst({
      where: { id, customerProfileId },
      select: { items: { select: { listingId: true, quantity: true } } },
    });
  },

  listForAdmin(status?: "ISSUED" | "ACCEPTED" | "EXPIRED") {
    return prisma.quotation.findMany({
      where: status ? { status } : undefined,
      select: {
        id: true,
        reference: true,
        origin: true,
        status: true,
        total: true,
        currency: true,
        issuedAt: true,
        expiresAt: true,
        items: { select: { id: true } },
        customerProfile: { select: { displayName: true, user: { select: { email: true } } } },
      },
      orderBy: { issuedAt: "desc" },
      take: 200,
    });
  },

  /**
   * (M11.1) Paginated variant of listForAdmin, for the admin quotations
   * queue page. listForAdmin itself stays unbounded (capped at 200) — it's
   * also used by admin-dashboard's quotationAttention(), which needs the
   * full ISSUED set to scan for custom quotes nearing expiry, not one page
   * of it.
   */
  async listForAdminPaginated(status: "ISSUED" | "ACCEPTED" | "EXPIRED" | undefined, page: number, pageSize: number) {
    const where = status ? { status } : undefined;
    const [rows, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        select: {
          id: true,
          reference: true,
          origin: true,
          status: true,
          total: true,
          currency: true,
          issuedAt: true,
          expiresAt: true,
          items: { select: { id: true } },
          customerProfile: { select: { displayName: true, user: { select: { email: true } } } },
        },
        orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.quotation.count({ where }),
    ]);
    return { rows, total };
  },

  findDetailForAdmin(id: string) {
    return prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        reference: true,
        status: true,
        currency: true,
        subtotal: true,
        total: true,
        issuedAt: true,
        expiresAt: true,
        acceptedAt: true,
        order: { select: { id: true } },
        items: { select: adminQuotationItemSelect, orderBy: { id: "asc" as const } },
        customerProfile: { select: { displayName: true, user: { select: { email: true } } } },
      },
    });
  },

  // --- M6 Custom Sourcing ------------------------------------------------

  /** The one active (still-ISSUED) quote for a request, if any — the one a reissue supersedes. */
  findActiveQuotationForSourcingRequest(sourcingRequestId: string) {
    return prisma.quotation.findFirst({
      where: { sourcingRequestId, status: "ISSUED" },
      select: { id: true },
    });
  },

  /**
   * A CUSTOM_SOURCING quote always has exactly one QuotationItem (M6 does
   * not support multi-line custom requests — see schema.prisma's
   * CustomSourcingRequest comment). `vendorId` is populated only when
   * modules/sourcing/service.ts determined the whole line traces to one
   * marketplace Vendor; `listingId` is always null (never VendorListing-
   * backed, even then). Superseding an existing active quote happens in
   * the same transaction as issuing the new one, so the two are never
   * observably out of sync.
   */
  issueCustomSourcingQuotation(params: {
    reference: string;
    customerProfileId: string;
    sourcingRequestId: string;
    supersedesQuotationId?: string;
    currency: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vendorPayableBasis: number;
    vendorId: string | null;
    expiresAt: Date;
  }) {
    const lineTotal = params.unitPrice * params.quantity;
    return prisma.$transaction(async (tx) => {
      if (params.supersedesQuotationId) {
        await tx.quotation.update({
          where: { id: params.supersedesQuotationId },
          data: { status: "SUPERSEDED" },
        });
      }
      return tx.quotation.create({
        data: {
          reference: params.reference,
          origin: "CUSTOM_SOURCING",
          customerProfileId: params.customerProfileId,
          sourcingRequestId: params.sourcingRequestId,
          supersedesQuotationId: params.supersedesQuotationId,
          currency: params.currency,
          subtotal: lineTotal,
          total: lineTotal,
          expiresAt: params.expiresAt,
          items: {
            create: {
              description: params.description,
              quantity: params.quantity,
              unitPrice: params.unitPrice,
              vendorPayableBasis: params.vendorPayableBasis,
              lineTotal,
              vendorId: params.vendorId,
            },
          },
        },
      });
    });
  },
};
