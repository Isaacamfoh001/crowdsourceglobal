// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../../lib/db";
import { quotationService } from "../../../../../modules/quotation/service";
import { ordersService } from "../../../../../modules/orders/service";

vi.mock("../../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../../modules/identity/policy";
import { GET } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

const deliveryInfo = {
  recipientName: "Ama Customer",
  phone: "0244111222",
  addressLine1: "5 Customer Close",
  city: "Accra",
  region: "Greater Accra",
};

function sessionFor(user: { id: string; email: string; name: string }): Session {
  return {
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId: user.id, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

describe("GET /api/v1/orders/[id]", () => {
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdQuotationIds: string[] = [];
  const createdOrderIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    // Same explicit teardown order as modules/fulfilment/service.test.ts —
    // FulfilmentItem/VendorEarning have no onDelete: Cascade back to
    // OrderItem, so they must be removed before Order/OrderItem deletion.
    await prisma.shipment.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.vendorEarning.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.fulfilmentItem.deleteMany({ where: { fulfilment: { orderId: { in: createdOrderIds } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.quotationItem.deleteMany({ where: { quotationId: { in: createdQuotationIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: createdQuotationIds } } });
    await prisma.vendorCostRule.deleteMany({ where: { listingId: { in: createdListingIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function setup(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: `Order Route Vendor ${label}`, storefrontSlug: `order-route-vendor-${label}-${suffix}`, verificationStatus: "APPROVED", country: "Ghana" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: `Order Route Category ${label}`, slug: `order-route-category-${label}-${suffix}` } });
    createdCategoryIds.push(category.id);
    const listing = await prisma.vendorListing.create({
      data: { vendorId: vendor.id, categoryId: category.id, title: "Order Route Listing", description: "Fixture.", basePrice: 25, moq: 1, availableQuantity: 50, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    createdListingIds.push(listing.id);

    const user = await prisma.user.create({ data: { id: `order-route-customer-${label}-${suffix}`, name: `Order Route ${label}`, email: `order.route.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    const profile = await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Order Route ${label}` } });

    const generated = await quotationService.generateFromDraft(profile.id, user.id, user.email, [{ listingId: listing.id, quantity: 1 }]);
    if (!generated.ok) throw new Error(generated.error);
    createdQuotationIds.push(generated.value.quotationId);

    const accepted = await ordersService.createOrderFromQuotation(profile.id, generated.value.quotationId, deliveryInfo);
    if (!accepted.ok) throw new Error(accepted.error);
    createdOrderIds.push(accepted.value.orderId);

    return { user, orderId: accepted.value.orderId };
  }

  it("returns 401 when signed out", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/orders/x"), { params: Promise.resolve({ id: "x" }) });
    expect(response.status).toBe(401);
  });

  it("returns the owner's own order, pending payment, full DTO-safe (M26)", async () => {
    const { user, orderId } = await setup("owner");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    const response = await GET(new Request(`http://localhost/api/v1/orders/${orderId}`), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.orderNumber).toEqual(expect.any(String));
    expect(body.data.status).toBe("PENDING_PAYMENT");
    expect(body.data.paymentStatus).toBe("UNPAID");
    // Every M24 field is still present (checkout confirmation/payment
    // screens only read a subset), plus the M26 full-detail additions.
    expect(Object.keys(body.data).sort()).toEqual(
      [
        "id",
        "orderNumber",
        "createdAt",
        "status",
        "paymentStatus",
        "subtotal",
        "total",
        "currency",
        "deliveryInfo",
        "displayStatus",
        "displayStatusLabel",
        "vendorGroups",
        "packages",
        "latestPaymentStatus",
        "latestPayment",
        "tracking",
        "cases",
      ].sort(),
    );
    // No Fulfilment exists yet (still PENDING_PAYMENT) — never fabricated.
    expect(body.data.tracking).toEqual([]);
    expect(body.data.packages).toEqual([]);
    expect(body.data.cases).toEqual([]);
    // Never a vendor-cost/finance field, on the item or anywhere else.
    const raw = JSON.stringify(body.data);
    expect(raw).not.toMatch(/vendorPayableBasis|vendorCost|payoutHold/i);
  });

  it("returns per-package tracking with real timestamps once confirmed, never vendor cost", async () => {
    const { user, orderId } = await setup("confirmed");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    await ordersService.confirmOrderPayment(orderId);

    const response = await GET(new Request(`http://localhost/api/v1/orders/${orderId}`), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("CONFIRMED");
    expect(body.data.tracking).toHaveLength(1);
    expect(body.data.tracking[0].vendorName).toEqual(expect.any(String));
    expect(body.data.tracking[0].steps[0].key).toBe("confirmed");
    // Freshly-created Fulfilment is still PENDING — "confirmed" is the
    // CURRENT step (not yet done; "preparing" is next), but it already has
    // a real timestamp: Fulfilment.createdAt, set the instant payment
    // confirmed this Order.
    expect(body.data.tracking[0].steps[0].current).toBe(true);
    expect(body.data.tracking[0].steps[0].at).toEqual(expect.any(String));
    const lastStep = body.data.tracking[0].steps.at(-1);
    expect(lastStep.done).toBe(false);
    expect(lastStep.at).toBeNull();
    expect(body.data.packages).toHaveLength(1);
    expect(body.data.packages[0].status).toBe("ORDER_CONFIRMED");
  });

  it("returns 404 for another customer's order (IDOR)", async () => {
    const { orderId } = await setup("victim");
    const attacker = await setup("attacker");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(attacker.user));
    const response = await GET(new Request(`http://localhost/api/v1/orders/${orderId}`), { params: Promise.resolve({ id: orderId }) });
    expect(response.status).toBe(404);
  });
});
