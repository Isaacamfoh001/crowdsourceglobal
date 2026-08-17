import { notificationsRepository } from "../modules/notifications/repository";
import { emailProvider } from "./email-provider";
import { renderRegisteredEmail } from "./email-templates-registry";

/** 1m, 5m, 30m, 2h, 12h — bounded, no infinite retry. */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

function nextAvailableAt(attemptsSoFar: number): Date {
  const minutes = BACKOFF_MINUTES[Math.min(attemptsSoFar - 1, BACKOFF_MINUTES.length - 1)] ?? 720;
  return new Date(Date.now() + minutes * 60_000);
}

type ClaimedJob = {
  id: string;
  to: string;
  subject: string;
  templateKey: string;
  templateData: unknown;
  attempts: number;
  maxAttempts: number;
};

async function processJob(job: ClaimedJob): Promise<void> {
  try {
    const { html, text } = renderRegisteredEmail(job.templateKey, job.templateData as Record<string, unknown>);
    await emailProvider.send({ to: job.to, subject: job.subject, html, text });
    await notificationsRepository.markJobSent(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = job.attempts >= job.maxAttempts;
    await notificationsRepository.markJobFailed(job.id, message, exhausted ? null : nextAvailableAt(job.attempts));
    console.error(`[email-worker] job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}): ${message}`);
  }
}

let inFlight: Promise<void> | null = null;

async function drain(): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    const job = await notificationsRepository.claimNextJob();
    if (!job) break;
    await processJob(job);
  }
}

/**
 * Drains eligible EmailDeliveryJob rows. This is called two ways: (1) as a
 * fire-and-forget dev-convenience kick right after `notificationsService
 * .notify()` enqueues a job, so local development sees emails "arrive"
 * immediately with zero extra setup; (2) by `scripts/process-email-jobs.ts`
 * on a real schedule in production, or a test awaiting it directly.
 * Neither call path is the source of delivery correctness — the persisted,
 * durably-claimed job row is; `claimNextJob`'s guarded `updateMany` is the
 * actual cross-process mutual-exclusion mechanism.
 *
 * A call that arrives while a drain is already running awaits that SAME
 * in-flight drain rather than silently no-op-ing — critical for callers
 * (tests, the dev fire-and-forget kick racing an explicit await) that need
 * to know the queue has actually been drained, not just that "someone else
 * is on it." An earlier version returned immediately in that case, which
 * could leave a just-enqueued job unprocessed until the next trigger.
 */
export function processEmailQueue(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = drain()
    .catch((error) => {
      console.error("[email-worker] queue processing failed:", error);
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
