"use server";

import { revalidatePath } from "next/cache";
import { requireAdminFinanceMutation } from "../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../modules/vendor-finance/service";
import { err, type Result } from "../result";

export async function createSettlementAction(_prevState: Result<{ settlementId: string }> | null, formData: FormData): Promise<Result<{ settlementId: string }>> {
  await requireAdminFinanceMutation("/admin/finance");
  const vendorId = String(formData.get("vendorId") ?? "");
  const earningIds = formData.getAll("earningId").map(String).filter(Boolean);
  if (!vendorId) return err("Vendor not found.");

  const result = await vendorFinanceService.createSettlement(vendorId, earningIds);
  if (!result.ok) return result;

  revalidatePath(`/admin/finance/vendors/${vendorId}`);
  revalidatePath("/admin/finance/settlements");
  return result;
}

export async function approveSettlementAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminFinanceMutation("/admin/finance");
  const settlementId = String(formData.get("settlementId") ?? "");

  const result = await vendorFinanceService.approveSettlement(settlementId, session.user.id);
  if (!result.ok) return result;

  revalidatePath(`/admin/finance/settlements/${settlementId}`);
  return result;
}

export async function cancelSettlementAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  await requireAdminFinanceMutation("/admin/finance");
  const settlementId = String(formData.get("settlementId") ?? "");

  const result = await vendorFinanceService.cancelSettlement(settlementId);
  if (!result.ok) return result;

  revalidatePath(`/admin/finance/settlements/${settlementId}`);
  return result;
}

export async function recordSettlementPayoutAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminFinanceMutation("/admin/finance");
  const settlementId = String(formData.get("settlementId") ?? "");

  const result = await vendorFinanceService.recordPayout(
    settlementId,
    {
      method: String(formData.get("method") ?? ""),
      externalReference: String(formData.get("externalReference") ?? ""),
      paidAt: String(formData.get("paidAt") ?? ""),
      note: String(formData.get("note") ?? ""),
    },
    session.user.id,
  );
  if (!result.ok) return result;

  revalidatePath(`/admin/finance/settlements/${settlementId}`);
  return result;
}

export async function reverseSettlementAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminFinanceMutation("/admin/finance");
  const settlementId = String(formData.get("settlementId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const result = await vendorFinanceService.reverseSettlement(settlementId, reason, session.user.id);
  if (!result.ok) return result;

  revalidatePath(`/admin/finance/settlements/${settlementId}`);
  return result;
}

export async function createManualAdjustmentAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminFinanceMutation("/admin/finance");
  const vendorId = String(formData.get("vendorId") ?? "");
  const vendorEarningId = String(formData.get("vendorEarningId") ?? "") || null;
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "");

  if (!vendorId) return err("Vendor not found.");
  if (Number.isNaN(amount)) return err("Enter a valid amount.");

  const result = await vendorFinanceService.createManualAdjustment({ vendorId, vendorEarningId, amount, reason, actorUserId: session.user.id });
  if (!result.ok) return result;

  revalidatePath(`/admin/finance/vendors/${vendorId}`);
  return result;
}
