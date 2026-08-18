import { NextResponse } from "next/server";
import { paymentsService } from "../../../../../modules/payments/service";

/**
 * Public, provider-facing callback endpoint — never authenticated via
 * Better Auth customer sessions (a webhook can't carry a customer cookie,
 * and a customer cookie proves nothing about Moolre). All business logic
 * lives in paymentsService.handleMoolreWebhook, which treats this payload
 * purely as a trigger and always independently re-verifies status with
 * Moolre before ever confirming an Order — see modules/payments/service.ts.
 * Always acks 200 so Moolre doesn't endlessly retry redelivery; the
 * meaningful outcome is recorded internally regardless of what's returned.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const sourceIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : null;

  try {
    await paymentsService.handleMoolreWebhook(body, sourceIp);
  } catch (error) {
    console.error("Moolre webhook processing failed:", error);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
