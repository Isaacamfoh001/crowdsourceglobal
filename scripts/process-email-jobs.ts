import "dotenv/config";
import { processEmailQueue } from "../lib/email-worker";

/**
 * Standalone durable-email-job processor. Run on a schedule in production
 * (cron, a deployment-platform scheduled task, etc. — the specific
 * scheduler is a deployment decision, not made here; see
 * docs/architecture/overview.md). Idempotent and safe to run concurrently
 * with itself or the in-process dev-convenience drain — job claiming is
 * done via a guarded `updateMany` (modules/notifications/repository.ts),
 * never assumed exclusive by this script alone.
 *
 * Usage: npm run jobs:email
 */
async function main() {
  await processEmailQueue();
  console.log("[jobs:email] queue drained.");
  process.exit(0);
}

main().catch((error) => {
  console.error("[jobs:email] fatal error:", error);
  process.exit(1);
});
