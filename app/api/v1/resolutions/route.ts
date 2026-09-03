import { getCurrentSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { resolutionsService } from "../../../../modules/resolutions/service";
import { apiError, apiSuccess } from "../../../../lib/api/response";
import type { RequestedResolution, ResolutionIssueType } from "../../../../modules/resolutions/types";

/**
 * POST /api/v1/resolutions (M29.1) — case CREATION from mobile ("Report a
 * problem"). `multipart/form-data`: orderId, issueType, requestedResolution?,
 * description, fulfilmentId?, repeated orderItemId+quantity pairs, 0-N
 * `evidence` image file parts. Thin route over the EXISTING
 * resolutionsService.submitCase + addAttachment — the exact same two calls
 * the web submitResolutionCaseAction makes, in the same order. No new
 * resolution type, no new state machine, no client-controlled outcome —
 * the created case always starts OPEN and goes through the existing
 * CrownSource/admin review process (modules/resolutions/service.ts).
 */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return apiError("FORBIDDEN", "A customer profile is required.");

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected multipart/form-data.");
  }

  const orderId = String(formData.get("orderId") ?? "");
  const issueType = String(formData.get("issueType") ?? "") as ResolutionIssueType;
  const description = String(formData.get("description") ?? "");
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "") || undefined;
  const requestedResolutionRaw = String(formData.get("requestedResolution") ?? "");
  const requestedResolution = (requestedResolutionRaw || undefined) as RequestedResolution | undefined;

  const orderItemIds = formData.getAll("orderItemId").map(String);
  const quantities = formData.getAll("quantity").map((v) => Number(v));
  const items: { orderItemId: string; quantity: number }[] = [];
  for (let i = 0; i < orderItemIds.length; i += 1) {
    const id = orderItemIds[i];
    const quantity = quantities[i];
    if (id && quantity && quantity > 0) items.push({ orderItemId: id, quantity });
  }

  const result = await resolutionsService.submitCase(customerProfile.id, session.user.id, {
    orderId,
    issueType,
    requestedResolution,
    description,
    fulfilmentId,
    items,
  });
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  for (const entry of formData.getAll("evidence")) {
    if (entry instanceof File && entry.size > 0) {
      await resolutionsService.addAttachment(customerProfile.id, session.user.id, result.value.caseId, {
        buffer: Buffer.from(await entry.arrayBuffer()),
        filename: entry.name,
        mimeType: entry.type,
      });
    }
  }

  return apiSuccess({ caseId: result.value.caseId, caseNumber: result.value.caseNumber });
}
