import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../../../../modules/identity/policy";
import { paymentsService } from "../../../../../../../../modules/payments/service";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../../../../../lib/rate-limit";
import { resolveIpFromRequest } from "../../../../../../../../lib/api/request-ip";
import { apiError, apiSuccess } from "../../../../../../../../lib/api/response";
import { toPaymentStatusDTO } from "../../../../../../../../lib/api/dto/payments";

type Params = { id: string };

/** Same throttle as lib/actions/payment.ts's submitMobileMoneyOtpAction — a bounded code guessed against a real payment. */
const OTP_SUBMIT_RATE_LIMIT = { windowSeconds: 300, max: 5 };

/**
 * POST /api/v1/orders/:id/payments/mobile-money/otp (M25) — resubmits the
 * OTP against the SAME Payment/attempt, reusing
 * paymentsService.submitMobileMoneyOtp exactly. `:id` (orderId) is only
 * used for the rate-limit key/URL shape; the actual ownership check is on
 * `paymentId` (payment.order.customerProfileId), same as the web action.
 *
 * JSON body: { paymentId: string, phone: string, otpcode: string }
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to confirm this payment.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts can make payments.");

  await params; // orderId not needed beyond routing — paymentId is the real scope

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }

  const paymentId = typeof body === "object" && body !== null ? (body as { paymentId?: unknown }).paymentId : undefined;
  const phone = typeof body === "object" && body !== null ? (body as { phone?: unknown }).phone : undefined;
  const otpcode = typeof body === "object" && body !== null ? (body as { otpcode?: unknown }).otpcode : undefined;

  if (typeof paymentId !== "string" || !paymentId) return apiError("VALIDATION_ERROR", "paymentId is required.");
  if (typeof phone !== "string" || !phone) return apiError("VALIDATION_ERROR", "phone is required.");
  if (typeof otpcode !== "string" || !otpcode) return apiError("VALIDATION_ERROR", "otpcode is required.");

  const rateLimit = await checkActionRateLimit(
    `otp-submit:${resolveIpFromRequest(request)}:${customerProfile.id}`,
    OTP_SUBMIT_RATE_LIMIT,
  );
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  const result = await paymentsService.submitMobileMoneyOtp({
    customerProfileId: customerProfile.id,
    paymentId,
    phone,
    otpcode,
  });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess(toPaymentStatusDTO(result.value));
}
