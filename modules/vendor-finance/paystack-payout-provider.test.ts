import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PayoutDestinationSnapshot } from "./types";

const createTransferRecipient = vi.fn();
const initiateTransfer = vi.fn();
const verifyTransfer = vi.fn();
vi.mock("../payments/providers/paystack/client", () => ({
  paystackClient: {
    createTransferRecipient: (...args: unknown[]) => createTransferRecipient(...args),
    initiateTransfer: (...args: unknown[]) => initiateTransfer(...args),
    verifyTransfer: (...args: unknown[]) => verifyTransfer(...args),
  },
}));

const resolveMomoBankCode = vi.fn();
const resolveGhipssBankCode = vi.fn();
vi.mock("../payments/providers/paystack/bank-codes", () => ({
  resolveMomoBankCode: (...args: unknown[]) => resolveMomoBankCode(...args),
  resolveGhipssBankCode: (...args: unknown[]) => resolveGhipssBankCode(...args),
}));

const { paystackPayoutProvider } = await import("./paystack-payout-provider");

const momoDestination: PayoutDestinationSnapshot = { type: "MOBILE_MONEY", momoAccountName: "Jane Vendor", momoPhone: "0244111111", momoNetwork: "MTN" };
const bankDestination: PayoutDestinationSnapshot = { type: "BANK_TRANSFER", bankAccountName: "Jane Vendor Ltd", bankName: "GCB Bank", bankAccountNumber: "1234567890" };

beforeEach(() => {
  createTransferRecipient.mockReset();
  initiateTransfer.mockReset();
  verifyTransfer.mockReset();
  resolveMomoBankCode.mockReset();
  resolveGhipssBankCode.mockReset();
});

describe("paystackPayoutProvider.resolveRecipient", () => {
  it("creates a mobile_money recipient using the resolved bank_code (a different code space from the Charge API)", async () => {
    resolveMomoBankCode.mockResolvedValueOnce({ ok: true, value: "MTN" });
    createTransferRecipient.mockResolvedValueOnce({ ok: true, data: { data: { recipient_code: "RCP_1" } } });

    const result = await paystackPayoutProvider.resolveRecipient({ destination: momoDestination, vendorName: "Jane Vendor Co" });
    expect(result).toEqual({ ok: true, value: "RCP_1" });
    expect(createTransferRecipient).toHaveBeenCalledWith({ type: "mobile_money", name: "Jane Vendor", account_number: "0244111111", bank_code: "MTN", currency: "GHS" });
  });

  it("creates a ghipss recipient for bank destinations", async () => {
    resolveGhipssBankCode.mockResolvedValueOnce({ ok: true, value: "030100" });
    createTransferRecipient.mockResolvedValueOnce({ ok: true, data: { data: { recipient_code: "RCP_2" } } });

    const result = await paystackPayoutProvider.resolveRecipient({ destination: bankDestination, vendorName: "Jane Vendor Co" });
    expect(result).toEqual({ ok: true, value: "RCP_2" });
    expect(createTransferRecipient).toHaveBeenCalledWith({ type: "ghipss", name: "Jane Vendor Ltd", account_number: "1234567890", bank_code: "030100", currency: "GHS" });
  });

  it("fails closed, never guesses, when the bank code cannot be resolved", async () => {
    resolveMomoBankCode.mockResolvedValueOnce({ ok: false, error: "Paystack does not currently list a MTN Mobile Money channel for Ghana transfers." });
    const result = await paystackPayoutProvider.resolveRecipient({ destination: momoDestination, vendorName: "Jane Vendor Co" });
    expect(result.ok).toBe(false);
    expect(createTransferRecipient).not.toHaveBeenCalled();
  });

  it("fails closed when Paystack rejects the recipient creation itself", async () => {
    resolveMomoBankCode.mockResolvedValueOnce({ ok: true, value: "MTN" });
    createTransferRecipient.mockResolvedValueOnce({ ok: false, kind: "HTTP_ERROR", status: 400 });
    const result = await paystackPayoutProvider.resolveRecipient({ destination: momoDestination, vendorName: "Jane Vendor Co" });
    expect(result.ok).toBe(false);
  });
});

describe("paystackPayoutProvider.initiate — maps Paystack's documented Transfer status values", () => {
  it("amount is converted GHS -> pesewas, source is always 'balance'", async () => {
    initiateTransfer.mockResolvedValueOnce({ ok: true, data: { data: { status: "pending", transfer_code: "TRF_1", reference: "PYT-1" } } });
    await paystackPayoutProvider.initiate({ reference: "PYT-1", amount: 400, currency: "GHS", recipientCode: "RCP_1", reason: "Settlement SET-1" });
    expect(initiateTransfer).toHaveBeenCalledWith({ source: "balance", amount: 40000, recipient: "RCP_1", reason: "Settlement SET-1", currency: "GHS", reference: "PYT-1" });
  });

  it.each([
    ["success", "PAID"],
    ["pending", "PROCESSING"],
    ["queued", "PROCESSING"],
    ["failed", "FAILED"],
    ["reversed", "FAILED"],
    ["otp", "FAILED"],
  ] as const)("maps Paystack status '%s' -> %s", async (paystackStatus, expected) => {
    initiateTransfer.mockResolvedValueOnce({ ok: true, data: { data: { status: paystackStatus, transfer_code: "TRF_x", reference: "PYT-x" } } });
    const outcome = await paystackPayoutProvider.initiate({ reference: "PYT-x", amount: 10, currency: "GHS", recipientCode: "RCP_x", reason: "test" });
    expect(outcome.status).toBe(expected);
  });

  it("maps a network/timeout failure to UNKNOWN, never FAILED — genuinely uncertain, never guessed", async () => {
    initiateTransfer.mockResolvedValueOnce({ ok: false, kind: "TIMEOUT" });
    const outcome = await paystackPayoutProvider.initiate({ reference: "PYT-timeout", amount: 10, currency: "GHS", recipientCode: "RCP_x", reason: "test" });
    expect(outcome.status).toBe("UNKNOWN");
  });

  it("maps a definitive HTTP error to FAILED (safe to retry)", async () => {
    initiateTransfer.mockResolvedValueOnce({ ok: false, kind: "HTTP_ERROR", status: 400 });
    const outcome = await paystackPayoutProvider.initiate({ reference: "PYT-err", amount: 10, currency: "GHS", recipientCode: "RCP_x", reason: "test" });
    expect(outcome.status).toBe("FAILED");
  });
});

describe("paystackPayoutProvider.verify — independent re-check by CrownSourceGlobal's own reference", () => {
  it("maps a successful verify to PAID", async () => {
    verifyTransfer.mockResolvedValueOnce({ ok: true, data: { data: { status: "success", transfer_code: "TRF_v", reference: "PYT-v" } } });
    const outcome = await paystackPayoutProvider.verify("PYT-v");
    expect(outcome.status).toBe("PAID");
  });

  it("maps an unreachable Paystack to UNKNOWN, never a guessed terminal state", async () => {
    verifyTransfer.mockResolvedValueOnce({ ok: false, kind: "NETWORK" });
    const outcome = await paystackPayoutProvider.verify("PYT-v2");
    expect(outcome.status).toBe("UNKNOWN");
  });
});
