"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentSession, requireSession, getCurrentCustomerProfile } from "../../modules/identity/policy";
import { quotationService } from "../../modules/quotation/service";
import { ordersService } from "../../modules/orders/service";
import { err, ok, type Result } from "../result";
import { safeRedirect } from "../safe-redirect";
import { parseDeliveryFormData, maybeSaveAddressFromCheckout } from "../delivery-schema";
import type { QuoteDraftLine } from "../../modules/quotation/types";
import type { DeliveryInfo } from "../../modules/orders/types";

const QUOTE_DRAFT_COOKIE = "csg_quote_draft";
const PENDING_QUOTE_INTENT_COOKIE = "csg_pending_quote_intent";
const MAX_DRAFT_LINES = 20;

const draftLineSchema = z.object({
  listingId: z.string().trim().min(1),
  quantity: z.number().int().positive(),
});
const draftSchema = z.array(draftLineSchema).max(MAX_DRAFT_LINES);

function readDraftCookieValue(raw: string | undefined): QuoteDraftLine[] {
  if (!raw) return [];
  try {
    return draftSchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeDraftCookie(lines: QuoteDraftLine[]): Promise<void> {
  const jar = await cookies();
  jar.set(QUOTE_DRAFT_COOKIE, JSON.stringify(lines.slice(0, MAX_DRAFT_LINES)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60, // 1 hour — a working-state cookie, not a commercial artifact
    path: "/",
  });
}

/** Read directly from a Server Component (same pattern as getPendingMessageIntent) or from an action below. */
export async function getQuoteDraftLines(): Promise<QuoteDraftLine[]> {
  const jar = await cookies();
  return readDraftCookieValue(jar.get(QUOTE_DRAFT_COOKIE)?.value);
}

/**
 * A guest's selected listing/quantity must survive the sign-in detour, same
 * rationale and mechanism as messaging's pending-message-intent cookie (see
 * lib/actions/messaging.ts) — HttpOnly so it's never exposed to JS/URLs, and
 * resumed as an explicit prompt on return, never auto-added silently.
 */
export async function getPendingQuoteIntent(listingId: string): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(PENDING_QUOTE_INTENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = draftLineSchema.parse(JSON.parse(raw));
    return parsed.listingId === listingId ? parsed.quantity : null;
  } catch {
    return null;
  }
}

/**
 * "Get Instant Quote" on a listing page. Signed-in customers add the line
 * directly and land on the builder; signed-out visitors get their selection
 * stashed and are sent to sign-in, landing back on the same listing with a
 * resume prompt (see getPendingQuoteIntent) rather than losing their choice.
 */
export async function addToQuoteDraftAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const listingId = String(formData.get("listingId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const currentPath = safeRedirect(String(formData.get("currentPath") ?? ""), "/shop");

  if (!listingId || !Number.isInteger(quantity) || quantity <= 0) {
    return err("Enter a valid quantity.");
  }

  const session = await getCurrentSession();
  if (!session) {
    const jar = await cookies();
    jar.set(PENDING_QUOTE_INTENT_COOKIE, JSON.stringify({ listingId, quantity }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 15,
      path: "/",
    });
    redirect(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
  }

  const existing = await getQuoteDraftLines();
  const withoutThisListing = existing.filter((line) => line.listingId !== listingId);
  const priorQuantity = existing.find((line) => line.listingId === listingId)?.quantity ?? 0;
  await writeDraftCookie([...withoutThisListing, { listingId, quantity: priorQuantity + quantity }]);

  const jar = await cookies();
  jar.delete(PENDING_QUOTE_INTENT_COOKIE);

  redirect("/quote/builder");
}

export async function updateQuoteDraftLineAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireSession("/quote/builder");
  const listingId = String(formData.get("listingId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  const existing = await getQuoteDraftLines();
  const next = Number.isInteger(quantity) && quantity > 0
    ? existing.map((line) => (line.listingId === listingId ? { ...line, quantity } : line))
    : existing.filter((line) => line.listingId !== listingId);

  await writeDraftCookie(next);
  revalidatePath("/quote/builder");
  return ok(null);
}

export async function removeQuoteDraftLineAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireSession("/quote/builder");
  const listingId = String(formData.get("listingId") ?? "");
  const existing = await getQuoteDraftLines();
  await writeDraftCookie(existing.filter((line) => line.listingId !== listingId));
  revalidatePath("/quote/builder");
  return ok(null);
}

/**
 * Authoritative issuance. Nothing about the draft cookie's contents is
 * trusted beyond listingId/quantity — quotationService re-derives every
 * commercial value server-side (see modules/quotation/service.ts).
 */
export async function generateQuoteAction(
  _prevState: Result<null> | null,
  _formData: FormData,
): Promise<Result<null>> {
  const session = await requireSession("/quote/builder");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) {
    return err("Something went wrong. Please try again.");
  }

  const draftLines = await getQuoteDraftLines();
  const result = await quotationService.generateFromDraft(customerProfile.id, session.user.id, session.user.email, draftLines);
  if (!result.ok) {
    return result;
  }

  const jar = await cookies();
  jar.delete(QUOTE_DRAFT_COOKIE);

  redirect(`/account/quotes/${result.value.quotationId}?issued=true`);
}

/**
 * "Get Updated Quote" from an expired/old quotation — reissues a fresh
 * draft from the same listings/quantities, re-validated entirely from
 * scratch (no reuse of the old snapshot's prices).
 */
export async function reissueQuoteAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const session = await requireSession("/account/quotes");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) {
    return err("Something went wrong. Please try again.");
  }

  const quotationId = String(formData.get("quotationId") ?? "");
  const lines = await quotationService.getLinesForReissue(quotationId, customerProfile.id);
  if (!lines || lines.length === 0) {
    return err("Quotation not found.");
  }

  await writeDraftCookie(lines);
  redirect("/quote/builder");
}

/**
 * Quote acceptance → PENDING_PAYMENT Order (ADR 0004 sequencing, same as
 * cart checkout) → redirect into the existing, unmodified mock-payment flow.
 */
export async function createOrderFromQuoteAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const quotationId = String(formData.get("quotationId") ?? "");
  const session = await requireSession(`/checkout/quote/${quotationId}`);
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) {
    return err("Something went wrong. Please try again.");
  }

  const parsed = parseDeliveryFormData(formData);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Check the delivery details and try again.");
  }

  const deliveryInfo: DeliveryInfo = parsed.data;
  const result = await ordersService.createOrderFromQuotation(customerProfile.id, quotationId, deliveryInfo);
  if (!result.ok) {
    return result;
  }

  await maybeSaveAddressFromCheckout(formData, customerProfile.id, deliveryInfo);
  redirect(`/checkout/${result.value.orderId}/payment`);
}
