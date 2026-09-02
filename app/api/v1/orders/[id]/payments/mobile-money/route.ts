import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../../../modules/identity/policy";
import { paymentsService } from "../../../../../../../modules/payments/service";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../../../../lib/rate-limit";
import { resolveIpFromRequest } from "../../../../../../../lib/api/request-ip";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";
import { toPaymentStatusDTO } from "../../../../../../../lib/api/dto/payments";
import type { MobileMoneyNetworkCode } from "../../../../../../../modules/payments/types";

type Params = { id: string };

/** Same throttle as lib/actions/payment.ts's initiateMobileMoneyPaymentAction — calls out to the provider per attempt. */
const PAYMENT_INITIATE_RATE_LIMIT = { windowSeconds: 300, max: 10 };

const NETWORKS: MobileMoneyNetworkCode[] = ["MTN", "TELECEL", "AT"];

/**
 * POST /api/v1/orders/:id/payments/mobile-money (M25) — initiate a Mobile
 * Money payment attempt, reusing paymentsService.initiateMobileMoneyPayment
 * exactly (provider-neutral: routes to whichever real provider is active,
 * Paystack primary). A concurrent duplicate submission resumes the same
 * active attempt via the DB-level partial unique index the service already
 * enforces — no separate mobile-side idempotency key needed.
 *
 * JSON body: { network: "MTN" | "TELECEL" | "AT", phone: string }
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to pay for this order.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts can make payments.");

  const { id: orderId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }

  const network = typeof body === "object" && body !== null ? (body as { network?: unknown }).network : undefined;
  const phone = typeof body === "object" && body !== null ? (body as { phone?: unknown }).phone : undefined;

  if (typeof network !== "string" || !NETWORKS.includes(network as MobileMoneyNetworkCode)) {
    return apiError("VALIDATION_ERROR", "network must be one of MTN, TELECEL, AT.");
  }
  if (typeof phone !== "string" || !phone) {
    return apiError("VALIDATION_ERROR", "phone is required.");
  }

  const rateLimit = await checkActionRateLimit(
    `payment-initiate:${resolveIpFromRequest(request)}:${customerProfile.id}`,
    PAYMENT_INITIATE_RATE_LIMIT,
  );
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  const result = await paymentsService.initiateMobileMoneyPayment({
    customerProfileId: customerProfile.id,
    orderId,
    network: network as MobileMoneyNetworkCode,
    phone,
  });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess(toPaymentStatusDTO(result.value));
}
