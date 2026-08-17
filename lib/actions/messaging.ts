"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentSession, requireSession, getCurrentCustomerProfile } from "../../modules/identity/policy";
import { requireVendorPortalContext } from "../../modules/vendors/policy";
import { messagingService } from "../../modules/messaging/service";
import { err, ok, type Result } from "../result";
import { safeRedirect } from "../safe-redirect";

const contextualMessageSchema = z.object({
  contextType: z.enum(["LISTING", "VENDOR", "ORDER", "SOURCING_REQUEST", "RESOLUTION_CASE"]),
  contextRefId: z.string().trim().min(1),
  body: z.string().trim().min(1, "Write a message before sending."),
});

/**
 * A guest's typed message must survive the sign-in detour without ever
 * appearing in a URL/browser history (the message body is user-authored
 * free text). An HttpOnly, short-lived cookie carries it instead — cleared
 * once the resumed conversation is actually created, or naturally expires.
 * `getPendingMessageIntent` reads it back so the originating page can offer
 * to resume ("send this message you were writing") rather than silently
 * auto-sending on the user's behalf.
 */
const PENDING_INTENT_COOKIE = "csg_pending_message";

export async function getPendingMessageIntent(
  contextType: "LISTING" | "VENDOR" | "ORDER" | "SOURCING_REQUEST",
  contextRefId: string,
): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(PENDING_INTENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = contextualMessageSchema.parse(JSON.parse(raw));
    if (parsed.contextType === contextType && parsed.contextRefId === contextRefId) {
      return parsed.body;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Used when the visitor is signed out: stashes the message intent, then
 * sends them to sign-in with a same-origin return path back to the exact
 * listing/vendor page they were on (the existing safeRedirect mechanism),
 * so they land back where they started instead of on a bare /account.
 */
export async function stashMessageIntentAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = contextualMessageSchema.safeParse({
    contextType: formData.get("contextType"),
    contextRefId: formData.get("contextRefId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check your message and try again.");

  const currentPath = safeRedirect(String(formData.get("currentPath") ?? ""), "/shop");

  const jar = await cookies();
  jar.set(PENDING_INTENT_COOKIE, JSON.stringify(parsed.data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 15,
    path: "/",
  });

  redirect(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
}

/** "Ask about this item" / "Ask about this vendor" — customer-initiated, always CSG-managed. */
export async function startContextualConversationAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  // Signed-out visitors must never reach this action at all (see
  // stashMessageIntentAction) — but re-check defensively rather than
  // trusting the client to have picked the right action.
  const session = await getCurrentSession();
  if (!session) {
    return err("Please sign in to send this message — your draft has been saved.");
  }
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return err("Something went wrong. Please try again.");

  const parsed = contextualMessageSchema.safeParse({
    contextType: formData.get("contextType"),
    contextRefId: formData.get("contextRefId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check your message and try again.");

  const result = await messagingService.startOrContinueContextual({
    customerProfileId: customerProfile.id,
    senderUserId: session.user.id,
    ...parsed.data,
  });
  if (!result.ok) return result;

  const jar = await cookies();
  jar.delete(PENDING_INTENT_COOKIE);

  redirect(`/account/messages/${result.value.conversationId}`);
}

export async function customerReplyAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const session = await requireSession("/account/messages");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return err("Something went wrong. Please try again.");

  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "");
  const result = await messagingService.replyAsCustomer(customerProfile.id, session.user.id, conversationId, body);
  if (!result.ok) return result;
  revalidatePath(`/account/messages/${conversationId}`);
  return ok(null);
}

export async function startVendorConversationAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId, session } = await requireVendorPortalContext("/vendor/portal/messages");
  const body = String(formData.get("body") ?? "");
  const result = await messagingService.startVendorConversation(vendorId, session.user.id, body);
  if (!result.ok) return result;
  redirect(`/vendor/portal/messages/${result.value.conversationId}`);
}

export async function vendorReplyAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { vendorId, session } = await requireVendorPortalContext("/vendor/portal/messages");
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "");
  const result = await messagingService.replyAsVendor(vendorId, session.user.id, conversationId, body);
  if (!result.ok) return result;
  revalidatePath(`/vendor/portal/messages/${conversationId}`);
  return ok(null);
}

/** Vendor proactively messaging CrownSource about a specific resolution case (M9). */
export async function startVendorResolutionConversationAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { vendorId, session } = await requireVendorPortalContext("/vendor/portal/resolutions");
  const caseId = String(formData.get("caseId") ?? "");
  const body = String(formData.get("body") ?? "");
  const result = await messagingService.startOrContinueVendorContextual({
    vendorId,
    senderUserId: session.user.id,
    contextResolutionCaseId: caseId,
    body,
  });
  if (!result.ok) return result;
  redirect(`/vendor/portal/messages/${result.value.conversationId}`);
}
