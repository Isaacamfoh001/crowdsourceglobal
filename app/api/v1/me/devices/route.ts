import { getCurrentSession } from "../../../../../modules/identity/policy";
import { notificationsService } from "../../../../../modules/notifications/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import type { DevicePlatform } from "../../../../../modules/notifications/types";

const PLATFORMS: readonly DevicePlatform[] = ["IOS", "ANDROID"];

function isPlatform(value: unknown): value is DevicePlatform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/**
 * POST /api/v1/me/devices (M31) — register (or re-register) the calling
 * user's own device for push. `userId` always comes from the session,
 * never the request body — a client can only ever register a device for
 * itself (CLAUDE.md's "never trust client-provided ownership" concern).
 * Idempotent: calling this again with the same token just refreshes
 * `lastSeenAt`/reassigns ownership if a different account signed in on
 * this device since the last call (see PushDevice's schema doc comment).
 *
 * JSON body: { expoPushToken: string, platform: "IOS" | "ANDROID" }
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const { expoPushToken, platform } = (json ?? {}) as Record<string, unknown>;
  if (typeof expoPushToken !== "string" || !expoPushToken.trim()) {
    return apiError("VALIDATION_ERROR", "expoPushToken is required.");
  }
  if (!isPlatform(platform)) {
    return apiError("VALIDATION_ERROR", "platform must be IOS or ANDROID.");
  }

  const result = await notificationsService.registerDevice(session.user.id, { expoPushToken, platform });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess({ registered: true });
}

/**
 * DELETE /api/v1/me/devices?expoPushToken=... (M31) — unregister one of the
 * calling user's own devices, called on sign-out so this device stops
 * receiving that account's pushes immediately (M31 §11's privacy
 * boundary). A query param, not a JSON body — the mobile `apiClient.delete`
 * helper deliberately never sends a body (matching every other DELETE
 * route in this API), so this stays consistent with that convention
 * instead of being the one route that needs a body-sending exception.
 * Scoped to the caller's own `userId` inside notificationsService —
 * removing a token that isn't currently this user's own is a safe no-op,
 * never an error (matches every other ownership-scoped delete in this
 * API).
 */
export async function DELETE(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const url = new URL(request.url);
  const expoPushToken = url.searchParams.get("expoPushToken");
  if (!expoPushToken || !expoPushToken.trim()) {
    return apiError("VALIDATION_ERROR", "expoPushToken is required.");
  }

  await notificationsService.unregisterDevice(session.user.id, expoPushToken);
  return apiSuccess({ unregistered: true });
}
