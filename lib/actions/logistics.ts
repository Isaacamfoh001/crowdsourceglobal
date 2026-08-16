"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "../../modules/administration/policy";
import { logisticsService } from "../../modules/logistics/service";
import { err, ok, type Result } from "../result";

const ADMIN_OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"] as const;

const locationSchema = z.object({
  name: z.string().trim().min(2, "Enter a location name."),
  type: z.string().trim().optional(),
  country: z.string().trim().min(2, "Enter a country."),
  region: z.string().trim().optional(),
  city: z.string().trim().optional(),
  addressLine1: z.string().trim().min(3, "Enter an address."),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
});

export async function createReceivingLocationAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/operations/receiving-locations", [...ADMIN_OPS_ROLES]);
  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || undefined,
    country: formData.get("country"),
    region: formData.get("region") || undefined,
    city: formData.get("city") || undefined,
    addressLine1: formData.get("addressLine1"),
    contactName: formData.get("contactName") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the location details.");

  const result = await logisticsService.create(parsed.data);
  if (!result.ok) return result;
  revalidatePath("/admin/operations/receiving-locations");
  return ok(null);
}

export async function setReceivingLocationActiveAction(formData: FormData): Promise<void> {
  await requireAdminSession("/admin/operations/receiving-locations", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  await logisticsService.setActive(id, active);
  revalidatePath("/admin/operations/receiving-locations");
}
