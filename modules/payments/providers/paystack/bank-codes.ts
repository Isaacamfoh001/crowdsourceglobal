import { paystackClient } from "./client";
import { ok, err, type Result } from "../../../../lib/result";
import type { PaystackRecipientType } from "./types";

type BankEntry = { name: string; code: string };

/**
 * In-memory only, process-lifetime cache with a short TTL — Ghana's bank
 * list changes essentially never, so re-fetching it from Paystack on every
 * payout would be pure waste, but this is deliberately NOT a shared cache
 * (Redis or otherwise): a single Map with a timestamp is the whole
 * mechanism, per CLAUDE.md §17 ("prefer no cache over an unnecessary one").
 */
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<PaystackRecipientType, { entries: BankEntry[]; fetchedAt: number }>();

/** Test-only — clears the process-lifetime cache so each test can control exactly what the mocked client returns. Never called from production code. */
export function clearPaystackBankCacheForTests(): void {
  cache.clear();
}

async function fetchGhanaBanks(type: PaystackRecipientType): Promise<Result<BankEntry[]>> {
  const cached = cache.get(type);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return ok(cached.entries);

  const result = await paystackClient.listBanks({ country: "ghana", currency: "GHS", type });
  if (!result.ok) return err("Could not reach Paystack to resolve bank details right now.");

  const entries = result.data.data.map((b) => ({ name: b.name, code: b.code }));
  cache.set(type, { entries, fetchedAt: Date.now() });
  return ok(entries);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(bank|ltd|limited|plc|ghana)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Ghana Mobile Money -> Transfer Recipient bank_code. NOT the same code
 * space as PAYSTACK_MOMO_PROVIDER_CODES (the Charge API's
 * mobile_money.provider field) — the Transfer Recipient API instead treats
 * each telco's mobile money wallet as an entry in the GET /bank?type=mobile_money
 * list, identified by name, never by a fixed short code.
 */
export async function resolveMomoBankCode(network: "MTN" | "TELECEL" | "AT"): Promise<Result<string>> {
  const banksResult = await fetchGhanaBanks("mobile_money");
  if (!banksResult.ok) return banksResult;

  const needle =
    network === "MTN" ? ["mtn"] : network === "TELECEL" ? ["telecel", "vodafone"] : ["airteltigo", "airtel", "tigo"];
  const match = banksResult.value.find((b) => needle.some((n) => b.name.toLowerCase().includes(n)));
  if (!match) return err(`Paystack does not currently list a ${network} Mobile Money channel for Ghana transfers.`);
  return ok(match.code);
}

/**
 * Ghana bank name (free text, as stored on VendorPayoutDestination.bankName)
 * -> GhIPSS Transfer Recipient bank_code. Matched, never guessed: an exact
 * normalized match is required first; a single unambiguous substring match
 * is accepted as a fallback. Anything else fails closed with a message
 * Admin can act on (correct the Vendor's bank name), rather than silently
 * picking a possibly-wrong bank.
 */
export async function resolveGhipssBankCode(bankName: string): Promise<Result<string>> {
  const needle = normalize(bankName);
  if (!needle) return err("This vendor's bank name is not set — cannot resolve it with Paystack.");

  const banksResult = await fetchGhanaBanks("ghipss");
  if (!banksResult.ok) return banksResult;

  const exact = banksResult.value.find((b) => normalize(b.name) === needle);
  if (exact) return ok(exact.code);

  const substringMatches = banksResult.value.filter((b) => normalize(b.name).includes(needle) || needle.includes(normalize(b.name)));
  if (substringMatches.length === 1) return ok(substringMatches[0]!.code);

  return err(`Paystack does not recognize the bank name "${bankName}" — ask the Vendor to confirm their bank and update their payout details.`);
}
