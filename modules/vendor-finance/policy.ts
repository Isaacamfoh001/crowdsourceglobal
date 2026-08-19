import { requireVendorPortalContext } from "../vendors/policy";
import { requireAdminSession, type AdminRole } from "../administration/policy";

/**
 * Payout-destination mutation is financially sensitive (CLAUDE.md §33 of
 * the M11 brief) — OWNER only. VendorMembership.role has existed since M3
 * but nothing has differentiated OWNER/STAFF capability until now; this is
 * the first real use of it.
 */
export async function requireVendorFinanceContext(redirectTo?: string) {
  return requireVendorPortalContext(redirectTo);
}

export function requireOwnerRole(role: string): boolean {
  return role === "OWNER";
}

/**
 * Finance mutations (create/approve/cancel Settlement, record payout,
 * manual adjustment, hold/release) are restricted to SUPER_ADMIN/
 * FINANCE_ADMIN. OPS_ADMIN may VIEW the Admin Finance area (read-only) but
 * never mutate it — the M8 role matrix never gave OPS_ADMIN payout
 * authority, and this milestone's brief is explicit that it shouldn't gain
 * it implicitly.
 */
const FINANCE_MUTATION_ROLES: AdminRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN"];
const FINANCE_VIEW_ROLES: AdminRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN", "OPS_ADMIN"];

export async function requireAdminFinanceView(redirectTo?: string) {
  return requireAdminSession(redirectTo, FINANCE_VIEW_ROLES);
}

export async function requireAdminFinanceMutation(redirectTo?: string) {
  return requireAdminSession(redirectTo, FINANCE_MUTATION_ROLES);
}
