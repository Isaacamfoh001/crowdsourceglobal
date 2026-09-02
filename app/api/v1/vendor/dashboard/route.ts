import { getCurrentSession } from "../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../lib/api/vendor-context";
import { vendorListingsService } from "../../../../../modules/vendor-listings/service";
import { fulfilmentService } from "../../../../../modules/fulfilment/service";
import { vendorFinanceService } from "../../../../../modules/vendor-finance/service";
import { serializeMoney, serializeDate, apiError, apiSuccess } from "../../../../../lib/api/response";

/**
 * GET /api/v1/vendor/dashboard (M27) — the operational Vendor Mode home
 * screen. Deliberately reuses the exact same three read calls and the same
 * derived counts as the web Vendor Portal dashboard
 * (app/vendor/portal/page.tsx) — no new aggregation service, no fabricated
 * metric. Unbounded `listForVendor`/`listForVendor` (not the paginated
 * variants) is intentional here too, same reasoning as the web page's doc
 * comment: this screen needs true counts across every listing/fulfilment,
 * not one page's worth.
 */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const [listings, orders, finance] = await Promise.all([
    vendorListingsService.listForVendor(context.vendorId),
    fulfilmentService.listForVendor(context.vendorId),
    vendorFinanceService.getOverviewForVendor(context.vendorId),
  ]);

  const active = listings.filter((l) => l.listingStatus === "ACTIVE").length;
  const pendingReview = listings.filter((l) => l.approvalStatus === "PENDING").length;
  const drafts = listings.filter((l) => l.listingStatus === "DRAFT" && l.approvalStatus !== "PENDING").length;
  const outOfStock = listings.filter((l) => l.availabilityStatus === "OUT_OF_STOCK").length;
  const lowStock = listings.filter((l) => l.availabilityStatus === "LOW_STOCK").length;
  const needsAttention = listings.filter((l) => l.approvalStatus === "CHANGES_REQUESTED");

  const newOrders = orders.filter((o) => o.status === "PENDING");
  const orderIssues = orders.filter((o) => o.hasOpenIssue);

  return apiSuccess({
    vendor: { companyName: context.vendor.companyName, verificationStatus: context.vendor.verificationStatus },
    stats: { active, pendingReview, drafts, outOfStock, lowStock },
    newOrders: newOrders.slice(0, 6).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      itemCount: o.itemCount,
      totalQuantity: o.totalQuantity,
      createdAt: serializeDate(o.createdAt),
    })),
    newOrdersTotal: newOrders.length,
    orderIssues: orderIssues.map((o) => ({ id: o.id, orderNumber: o.orderNumber })),
    listingsNeedingAttention: needsAttention.map((l) => ({ id: l.id, title: l.title, changesRequestedReason: l.changesRequestedReason })),
    finance: { availableForSettlement: serializeMoney(finance.availableForSettlement, finance.currency) },
  });
}
