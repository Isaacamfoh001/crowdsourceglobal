import "dotenv/config";
import { vendorFinanceService } from "../modules/vendor-finance/service";

/**
 * Time-based VendorEarning eligibility sweep — PENDING earnings whose
 * Fulfilment has been DELIVERED for at least VENDOR_PAYOUT_HOLD_HOURS become
 * ELIGIBLE. Never touches ON_HOLD earnings (those only leave ON_HOLD via an
 * explicit release, resolutionsService.resolveCase()). Same DB-backed-job
 * architecture as scripts/sweep-abandoned-payments.ts — no message broker.
 *
 * Usage: npm run jobs:sweep-earnings
 */
async function main() {
  const { madeEligible } = await vendorFinanceService.sweepEligibleEarnings();
  console.log(`[jobs:sweep-earnings] made ${madeEligible} earning(s) eligible.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[jobs:sweep-earnings] fatal error:", error);
  process.exit(1);
});
