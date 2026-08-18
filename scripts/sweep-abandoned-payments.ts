import "dotenv/config";
import { paymentsService } from "../modules/payments/service";

/**
 * Cancels Orders whose inventory reservation has expired with no successful
 * Payment, releasing their held stock (docs/workflows/workflows.md
 * Workflow F — a real gap M10A closes: real async Mobile Money payments can
 * genuinely be abandoned mid-flow, unlike the old synchronous mock flow).
 * Run on a schedule (cron, a deployment-platform scheduled task) — same
 * DB-backed-job architecture as scripts/process-email-jobs.ts, no message
 * broker.
 *
 * Usage: npm run jobs:sweep-payments
 */
async function main() {
  const { cancelled } = await paymentsService.sweepAbandonedPayments();
  console.log(`[jobs:sweep-payments] cancelled ${cancelled} abandoned order(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[jobs:sweep-payments] fatal error:", error);
  process.exit(1);
});
