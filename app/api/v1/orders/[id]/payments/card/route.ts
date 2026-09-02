import { getCurrentSession, getCurrentCustomerProfile } from "../../../../../../../modules/identity/policy";
import { paymentsService } from "../../../../../../../modules/payments/service";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../../../../lib/rate-limit";
import { resolveIpFromRequest } from "../../../../../../../lib/api/request-ip";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";
import { toPaymentStatusDTO } from "../../../../../../../lib/api/dto/payments";

type Params = { id: string };

/** Same throttle as lib/actions/payment.ts's initiateCardPaymentAction. */
const PAYMENT_INITIATE_RATE_LIMIT = { windowSeconds: 300, max: 10 };

/**
 * POST /api/v1/orders/:id/payments/card (M25) — initiate a card payment,
 * reusing paymentsService.initiateCardPayment exactly: always Paystack-
 * hosted Checkout, regardless of env.PAYMENT_PROVIDER. CrownSourceGlobal
 * never collects or sees card details — the returned `authorizationUrl` is
 * Paystack's own hosted page, opened in an in-app browser
 * (expo-web-browser) on the client, never a native card form.
 *
 * The `callbackUrl` this triggers server-side
 * (${NEXT_PUBLIC_APP_URL}/checkout/:orderId/payment/callback) is a WEB
 * page requiring a browser session cookie the in-app browser tab does not
 * share with the native app's session — so the mobile client must not rely
 * on that page rendering a signed-in result. Instead, after the in-app
 * browser is dismissed, the mobile client independently polls
 * `GET /api/v1/payments/:id` (this call's `payment.paymentId`) using its
 * own authenticated session — that poll re-verifies against Paystack
 * itself via the exact same funnel, so it is honest regardless of what the
 * browser tab displayed. The Paystack webhook remains authoritative
 * either way (CLAUDE.md §17-18).
 */
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to pay for this order.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts can make payments.");

  const { id: orderId } = await params;

  const rateLimit = await checkActionRateLimit(
    `payment-initiate:${resolveIpFromRequest(request)}:${customerProfile.id}`,
    PAYMENT_INITIATE_RATE_LIMIT,
  );
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  const result = await paymentsService.initiateCardPayment({ customerProfileId: customerProfile.id, orderId });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess({
    payment: toPaymentStatusDTO(result.value.payment),
    authorizationUrl: result.value.authorizationUrl,
  });
}
