import { beforeEach, describe, expect, it, vi } from "vitest";

const listBanks = vi.fn();
vi.mock("./client", () => ({ paystackClient: { listBanks: (...args: unknown[]) => listBanks(...args) } }));

const { resolveMomoBankCode, resolveGhipssBankCode, clearPaystackBankCacheForTests } = await import("./bank-codes");

const MOMO_BANKS = [
  { name: "MTN Mobile Money", code: "MTN" },
  { name: "Telecel Cash", code: "VOD" },
  { name: "AirtelTigo Money", code: "ATL" },
];
const GHIPSS_BANKS = [
  { name: "GCB Bank", code: "030100" },
  { name: "Ecobank Ghana", code: "130100" },
  { name: "Absa Bank Ghana", code: "030300" },
];

describe("resolveMomoBankCode — Ghana Mobile Money -> Transfer Recipient bank_code (a different code space from the Charge API's provider strings)", () => {
  beforeEach(() => {
    clearPaystackBankCacheForTests();
    listBanks.mockReset();
    listBanks.mockResolvedValue({ ok: true, data: { status: true, message: "", data: MOMO_BANKS } });
  });

  it.each([
    ["MTN", "MTN"],
    ["TELECEL", "VOD"],
    ["AT", "ATL"],
  ] as const)("resolves %s to Paystack's own bank_code from GET /bank?type=mobile_money", async (network, expectedCode) => {
    const result = await resolveMomoBankCode(network);
    expect(result).toEqual({ ok: true, value: expectedCode });
    expect(listBanks).toHaveBeenCalledWith({ country: "ghana", currency: "GHS", type: "mobile_money" });
  });

  it("fails closed when Paystack doesn't list a channel for the network — never guesses a code", async () => {
    listBanks.mockResolvedValue({ ok: true, data: { status: true, message: "", data: [] } });
    const result = await resolveMomoBankCode("MTN");
    expect(result.ok).toBe(false);
  });

  it("caches the bank list — a second resolution within the TTL does not re-fetch", async () => {
    await resolveMomoBankCode("MTN");
    await resolveMomoBankCode("TELECEL");
    expect(listBanks).toHaveBeenCalledTimes(1);
  });

  it("surfaces a clean error, never a throw, when Paystack is unreachable", async () => {
    listBanks.mockReset();
    listBanks.mockResolvedValue({ ok: false, kind: "NETWORK" });
    const result = await resolveMomoBankCode("MTN");
    expect(result.ok).toBe(false);
  });
});

describe("resolveGhipssBankCode — Vendor's free-text bank name -> GhIPSS bank_code, matched never guessed", () => {
  beforeEach(() => {
    clearPaystackBankCacheForTests();
    listBanks.mockReset();
    listBanks.mockResolvedValue({ ok: true, data: { status: true, message: "", data: GHIPSS_BANKS } });
  });

  it("matches an exact (normalized) bank name", async () => {
    const result = await resolveGhipssBankCode("GCB Bank");
    expect(result).toEqual({ ok: true, value: "030100" });
  });

  it("matches case/whitespace/suffix-insensitively", async () => {
    const result = await resolveGhipssBankCode("ecobank");
    expect(result).toEqual({ ok: true, value: "130100" });
  });

  it("fails closed on an unrecognized bank name rather than guessing", async () => {
    const result = await resolveGhipssBankCode("Totally Unknown Bank Of Nowhere");
    expect(result.ok).toBe(false);
  });

  it("fails closed on an empty bank name", async () => {
    const result = await resolveGhipssBankCode("");
    expect(result.ok).toBe(false);
    expect(listBanks).not.toHaveBeenCalled();
  });
});
