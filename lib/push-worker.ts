import { notificationsRepository } from "../modules/notifications/repository";
import { pushProvider, type PushMessage } from "./push-provider";

/** 1m, 5m, 30m, 2h, 12h — bounded, no infinite retry. Same schedule as lib/email-worker.ts's BACKOFF_MINUTES, kept as its own independent constant rather than shared — the two workers/providers are independent failure domains. */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

function nextAvailableAt(attemptsSoFar: number): Date {
  const minutes = BACKOFF_MINUTES[Math.min(attemptsSoFar - 1, BACKOFF_MINUTES.length - 1)] ?? 720;
  return new Date(Date.now() + minutes * 60_000);
}

type ClaimedPushJob = {
  id: string;
  notificationId: string;
  attempts: number;
  maxAttempts: number;
  notification: { recipientUserId: string; title: string; body: string; targetUrl: string; type: string };
};

/**
 * One notification, fanned out to every currently-registered device for its
 * recipient (M31 §12 — "one invalid token must not block others", "do not
 * create duplicate Notification rows per device": there is exactly one
 * PushDeliveryJob per Notification regardless of device count, and the
 * fan-out happens here at send time, never as separate persisted rows).
 *
 * `data` carries only what the mobile app's push-tap handler needs to
 * navigate — the same `targetUrl`/`type` already public on the in-app
 * Notification (M31 §9/§14: no vendor cost, no contact details, no
 * payment secrets ever touch a push payload, because none of that is on
 * Notification in the first place).
 */
async function processJob(job: ClaimedPushJob): Promise<void> {
  try {
    const devices = await notificationsRepository.findActiveDevicesForUser(job.notification.recipientUserId);
    if (devices.length === 0) {
      // Nothing to deliver to right now — not a failure; the in-app Notification already exists and remains the source of truth.
      await notificationsRepository.markPushJobSent(job.id);
      return;
    }

    const messages: PushMessage[] = devices.map((device: { expoPushToken: string }) => ({
      to: device.expoPushToken,
      title: job.notification.title,
      body: job.notification.body,
      data: { targetUrl: job.notification.targetUrl, type: job.notification.type, notificationId: job.notificationId },
    }));

    const results = await pushProvider.send(messages);
    for (const result of results) {
      if (result.deviceNotRegistered) {
        await notificationsRepository.deleteDeviceByToken(result.to);
      } else if (!result.ok) {
        console.error(`[push-worker] job ${job.id}: delivery to one device failed: ${result.error}`);
      }
    }
    await notificationsRepository.markPushJobSent(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = job.attempts >= job.maxAttempts;
    await notificationsRepository.markPushJobFailed(job.id, message, exhausted ? null : nextAvailableAt(job.attempts));
    console.error(`[push-worker] job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}): ${message}`);
  }
}

let inFlight: Promise<void> | null = null;

async function drain(): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    const job = await notificationsRepository.claimNextPushJob();
    if (!job) break;
    await processJob(job);
  }
}

/**
 * Drains eligible PushDeliveryJob rows. Unlike lib/email-worker.ts's
 * processEmailQueue, `notificationsService.notify()` does NOT fire this as
 * a dev-convenience kick — see notify()'s doc comment for why (no
 * "arrives instantly with zero setup" win for push the way there is for a
 * console-logged email, and skipping it halves the background DB queries
 * every notify() call in the app would otherwise make). The real call
 * path is scripts/process-push-jobs.ts (`npm run jobs:push`) on a
 * schedule, or a test awaiting this function directly. The persisted,
 * durably-claimed job row remains the source of delivery correctness
 * regardless of which caller drains it — same guarantee as email's.
 */
export function processPushQueue(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = drain()
    .catch((error) => {
      console.error("[push-worker] queue processing failed:", error);
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
