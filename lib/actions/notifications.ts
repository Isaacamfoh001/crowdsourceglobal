"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "../../modules/identity/policy";
import { notificationsService } from "../../modules/notifications/service";
import { ok, type Result } from "../result";
import type { PreferencesInput } from "../../modules/notifications/types";

/**
 * Ownership is enforced entirely server-side inside
 * notificationsService.markRead (WHERE id, recipientUserId together) —
 * the client can never mark another user's notification read no matter
 * what id it submits.
 */
export async function markNotificationReadAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const session = await requireSession("/account/notifications");
  const id = String(formData.get("id") ?? "");
  const result = await notificationsService.markRead(id, session.user.id);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function markAllNotificationsReadAction(
  _prevState: Result<null> | null,
  _formData: FormData,
): Promise<Result<null>> {
  const session = await requireSession("/account/notifications");
  const result = await notificationsService.markAllRead(session.user.id);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateNotificationPreferencesAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const session = await requireSession("/account/notifications/preferences");
  const input: PreferencesInput = {
    ordersDeliveryEmail: formData.get("ordersDeliveryEmail") === "on",
    quotationsSourcingEmail: formData.get("quotationsSourcingEmail") === "on",
    messagesEmail: formData.get("messagesEmail") === "on",
  };
  const result = await notificationsService.updatePreferences(session.user.id, input);
  if (!result.ok) return result;
  revalidatePath("/account/notifications/preferences");
  return ok(null);
}
