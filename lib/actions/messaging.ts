"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession, getCurrentCustomerProfile } from "../../modules/identity/policy";
import { requireVendorPortalContext } from "../../modules/vendors/policy";
import { messagingService } from "../../modules/messaging/service";
import { err, ok, type Result } from "../result";

/** "Ask about this item" / "Ask about this vendor" — customer-initiated, always CSG-managed. */
export async function startContextualConversationAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const session = await requireSession("/account/messages");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return err("Something went wrong. Please try again.");

  const contextType = String(formData.get("contextType") ?? "") as "LISTING" | "VENDOR";
  const contextRefId = String(formData.get("contextRefId") ?? "");
  const body = String(formData.get("body") ?? "");

  const result = await messagingService.startOrContinueContextual({
    customerProfileId: customerProfile.id,
    senderUserId: session.user.id,
    contextType,
    contextRefId,
    body,
  });
  if (!result.ok) return result;
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
