import { NextResponse } from "next/server";
import { paymentsService } from "../../../../../modules/payments/service";
import { verifyPaystackSignature } from "../../../../../modules/payments/providers/paystack/adapter";
import { vendorFinanceService } from "../../../../../modules/vendor-finance/service";

/**
 * Public, provider-facing callback endpoint — never authenticated via
 * Better Auth customer sessions. Unlike Moolre, Paystack documents a real
 * signature mechanism (HMAC-SHA512 of the raw request body, using the
 * secret key, in the `x-paystack-signature` header) — verified here,
 * against the exact raw bytes, BEFORE any JSON parsing. An invalid
 * signature is rejected outright; a valid one still only triggers an
 * independent server-to-server Verify Transaction call in
 * paymentsService.handlePaystackWebhook — the webhook body itself is never
 * sufficient to confirm an Order.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackSignature(rawBody, signature)) {
    console.error("Paystack webhook signature verification failed.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const sourceIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;

  const event = typeof parsed === "object" && parsed !== null && "event" in parsed ? String((parsed as { event: unknown }).event) : "";

  try {
    if (event.startsWith("charge.")) {
      await paymentsService.handlePaystackWebhook(parsed, sourceIp);
    } else if (event.startsWith("refund.")) {
      await paymentsService.handlePaystackRefundWebhook(parsed);
    } else if (event.startsWith("transfer.")) {
      // Vendor payouts (M12) — same discipline as refund.*: the webhook
      // body's `reference` is only ever a lookup key, never trusted for
      // status. See vendorFinanceService.handlePaystackTransferWebhook.
      await vendorFinanceService.handlePaystackTransferWebhook(parsed);
    }
  } catch (error) {
    console.error("Paystack webhook processing failed:", error);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
