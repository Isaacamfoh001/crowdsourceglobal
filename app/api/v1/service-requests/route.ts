import { getCurrentSession } from "../../../../modules/identity/policy";
import { serviceRequestsService } from "../../../../modules/service-requests/service";
import { parsePage } from "../../../../lib/pagination";
import { apiError, apiPage, apiSuccess } from "../../../../lib/api/response";
import { toServiceRequestDTO } from "../../../../lib/api/dto/service-requests";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../lib/rate-limit";

/**
 * GET /api/v1/service-requests (M22 §17) — the signed-in customer's own
 * submitted service requests, newest-first, page-paginated (same
 * convention as the Vendor Portal's own "my content" lists — not a public
 * feed's cursor shape).
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  const { rows, total, pageSize } = await serviceRequestsService.listForCustomer(session.user.id, page);
  return apiSuccess(apiPage({ rows: rows.map(toServiceRequestDTO), total, page, pageSize }));
}

const CREATE_RATE_LIMIT = { windowSeconds: 60 * 60, max: 20 };

/**
 * POST /api/v1/service-requests (M22 §12/§13) — the core "Request Service"
 * action. Authenticated only — browsing Beauty Services stays public, but
 * submitting a request requires sign-in (see the mobile client's
 * requireAuthPrompt boundary). `multipart/form-data`: professionalId,
 * serviceId, preferredDate (ISO date string), preferredTimeNote?,
 * locationMode (PROVIDER_LOCATION|CUSTOMER_LOCATION), locationDetails?,
 * notes?, quantity?, an optional single `referenceImage` file part.
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to request a service.");

  const rateLimit = await checkActionRateLimit(`service-request-create:${session.user.id}`, CREATE_RATE_LIMIT);
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected multipart/form-data.");
  }

  const professionalId = String(formData.get("professionalId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const preferredDate = String(formData.get("preferredDate") ?? "");
  const preferredTimeNote = formData.get("preferredTimeNote") ? String(formData.get("preferredTimeNote")) : undefined;
  const locationModeRaw = String(formData.get("locationMode") ?? "");
  const locationDetails = formData.get("locationDetails") ? String(formData.get("locationDetails")) : undefined;
  const notes = formData.get("notes") ? String(formData.get("notes")) : undefined;
  const quantityRaw = formData.get("quantity");
  const quantity = quantityRaw ? Number(quantityRaw) : undefined;

  if (locationModeRaw !== "PROVIDER_LOCATION" && locationModeRaw !== "CUSTOMER_LOCATION") {
    return apiError("VALIDATION_ERROR", "Choose where the service should take place.");
  }
  if (!professionalId || !serviceId || !preferredDate) {
    return apiError("VALIDATION_ERROR", "Missing required fields.");
  }

  let referenceImageFile: { buffer: Buffer; filename: string; mimeType: string } | null = null;
  const imageEntry = formData.get("referenceImage");
  if (imageEntry instanceof File && imageEntry.size > 0) {
    referenceImageFile = { buffer: Buffer.from(await imageEntry.arrayBuffer()), filename: imageEntry.name, mimeType: imageEntry.type };
  }

  const result = await serviceRequestsService.create(
    session.user.id,
    { professionalId, serviceId, preferredDate, preferredTimeNote, locationMode: locationModeRaw, locationDetails, notes, quantity },
    referenceImageFile,
  );
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess({ id: result.value.id }, { status: 201 });
}
