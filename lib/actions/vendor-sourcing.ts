"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVendorPortalContext } from "../../modules/vendors/policy";
import { sourcingService } from "../../modules/sourcing/service";
import { err, type Result } from "../result";

const respondSchema = z.object({
  proposedQuantity: z.coerce.number().int().positive("Enter a valid quantity."),
  unitPrice: z.coerce.number().positive("Enter a unit price greater than zero."),
  leadTimeDays: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().trim().optional(),
});

export async function respondToSolicitationAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/sourcing");
  const id = String(formData.get("id") ?? "");
  const canFulfil = formData.get("canFulfil") === "true";

  if (!canFulfil) {
    const result = await sourcingService.respondToSolicitation(id, vendorId, { canFulfil: false });
    if (result.ok) revalidatePath(`/vendor/portal/sourcing/${id}`);
    return result;
  }

  const parsed = respondSchema.safeParse({
    proposedQuantity: formData.get("proposedQuantity"),
    unitPrice: formData.get("unitPrice"),
    leadTimeDays: formData.get("leadTimeDays") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check your response and try again.");

  const result = await sourcingService.respondToSolicitation(id, vendorId, { canFulfil: true, ...parsed.data });
  if (result.ok) revalidatePath(`/vendor/portal/sourcing/${id}`);
  return result;
}
