import { getCurrentSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { sourcingService } from "../../../../modules/sourcing/service";
import { parsePage } from "../../../../lib/pagination";
import { apiError, apiPage, apiSuccess } from "../../../../lib/api/response";
import { toSourcingRequestSummaryDTO } from "../../../../lib/api/dto/sourcing";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../lib/rate-limit";

/**
 * GET /api/v1/sourcing-requests (M24) — the signed-in customer's own
 * submitted sourcing requests, newest-first, page-paginated. Same
 * ownership/pagination convention as /api/v1/service-requests.
 */
export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts can view sourcing requests.");

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page") ?? undefined);

  const { rows, total, pageSize } = await sourcingService.listForCustomer(customerProfile.id, page);
  return apiSuccess(apiPage({ rows: rows.map(toSourcingRequestSummaryDTO), total, page, pageSize }));
}

const CREATE_RATE_LIMIT = { windowSeconds: 60 * 60, max: 20 };

/**
 * POST /api/v1/sourcing-requests (M24) — "Show us what you're looking
 * for." Authenticated only (CustomSourcingRequest is CustomerProfile-owned,
 * same as web's /sourcing/new — see modules/sourcing/service.ts). Calls
 * the exact same sourcingService.submitRequest the web form calls — no
 * duplicated validation, pricing, or numbering logic.
 *
 * `multipart/form-data`: description (required unless at least one
 * attachment is present — M24 photo-first rule), title? (auto-derived when
 * omitted), quantity, quantityUnit?, deliveryCountry, deliveryRegion?,
 * deliveryCity?, requiredByDate? (ISO date), budgetAmount?,
 * budgetCurrency?, categoryId?, plus up to
 * lib/attachment-validation.ts's MAX_ATTACHMENTS_PER_REQUEST `attachments`
 * file parts (images only in practice from the native camera/gallery flow,
 * though the shared validator also allows PDF/CSV/XLSX, same as web).
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Sign in to submit a sourcing request.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "Only customer accounts can submit sourcing requests.");

  const rateLimit = await checkActionRateLimit(`sourcing-request-create:${session.user.id}`, CREATE_RATE_LIMIT);
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected multipart/form-data.");
  }

  const quantityRaw = Number(formData.get("quantity"));
  const requiredByRaw = String(formData.get("requiredByDate") ?? "");
  const budgetRaw = formData.get("budgetAmount");
  const titleRaw = String(formData.get("title") ?? "").trim();

  const files: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  for (const entry of formData.getAll("attachments")) {
    if (entry instanceof File && entry.size > 0) {
      files.push({ buffer: Buffer.from(await entry.arrayBuffer()), filename: entry.name, mimeType: entry.type });
    }
  }

  const result = await sourcingService.submitRequest(
    customerProfile.id,
    session.user.id,
    session.user.email,
    {
      title: titleRaw || undefined,
      description: String(formData.get("description") ?? ""),
      quantity: quantityRaw,
      quantityUnit: String(formData.get("quantityUnit") ?? "") || undefined,
      requiredByDate: requiredByRaw ? new Date(requiredByRaw) : undefined,
      deliveryCountry: String(formData.get("deliveryCountry") ?? ""),
      deliveryRegion: String(formData.get("deliveryRegion") ?? "") || undefined,
      deliveryCity: String(formData.get("deliveryCity") ?? "") || undefined,
      budgetAmount: budgetRaw ? Number(budgetRaw) : undefined,
      budgetCurrency: String(formData.get("budgetCurrency") ?? "") || undefined,
      categoryId: String(formData.get("categoryId") ?? "") || undefined,
    },
    files,
  );
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess({ id: result.value.id, requestNumber: result.value.requestNumber }, { status: 201 });
}
