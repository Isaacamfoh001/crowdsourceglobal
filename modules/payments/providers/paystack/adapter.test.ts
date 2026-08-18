import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/env", () => ({ env: { PAYSTACK_SECRET_KEY: "sk_test_fixture_secret" } }));

const createCharge = vi.fn();
vi.mock("./client", () => ({
  paystackClient: {
    createCharge: (...args: unknown[]) => createCharge(...args),
    submitOtp: vi.fn(),
  },
}));

const { verifyPaystackSignature, paystackPaymentProvider } = await import("./adapter");
const { PAYSTACK_MOMO_PROVIDER_CODES } = await import("./types");

function sign(rawBody: string): string {
  return crypto.createHmac("sha512", "sk_test_fixture_secret").update(rawBody).digest("hex");
}

describe("verifyPaystackSignature — Paystack's documented HMAC-SHA512 mechanism", () => {
  it("accepts a correctly signed raw body", () => {
    const rawBody = JSON.stringify({ event: "charge.success", data: { reference: "ref-1" } });
    expect(verifyPaystackSignature(rawBody, sign(rawBody))).toBe(true);
  });

  it("rejects an incorrect signature", () => {
    const rawBody = JSON.stringify({ event: "charge.success", data: { reference: "ref-1" } });
    expect(verifyPaystackSignature(rawBody, "0".repeat(128))).toBe(false);
  });

  it("rejects a modified body signed for different content (tamper detection)", () => {
    const original = JSON.stringify({ event: "charge.success", data: { reference: "ref-1", amount: 100 } });
    const signature = sign(original);
    const tampered = JSON.stringify({ event: "charge.success", data: { reference: "ref-1", amount: 999999 } });
    expect(verifyPaystackSignature(tampered, signature)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    const rawBody = JSON.stringify({ event: "charge.success", data: { reference: "ref-1" } });
    expect(verifyPaystackSignature(rawBody, null)).toBe(false);
  });
});

describe("paystackPaymentProvider.parseWebhook", () => {
  it("recognizes a charge.success event and extracts reference/providerReference", () => {
    const result = paystackPaymentProvider.parseWebhook({
      body: { event: "charge.success", data: { reference: "ref-1", id: 123, status: "success" } },
      sourceIp: "52.31.139.75",
    });
    expect(result.recognized).toBe(true);
    if (result.recognized) {
      expect(result.reference).toBe("ref-1");
      expect(result.providerReference).toBe("123");
      expect(result.claimedSucceeded).toBe(true);
      expect(result.sourceIpTrusted).toBe(true);
    }
  });

  it("ignores a refund.* event — those are routed separately by the webhook route, not this method", () => {
    const result = paystackPaymentProvider.parseWebhook({ body: { event: "refund.processed", data: { id: 1 } }, sourceIp: null });
    expect(result.recognized).toBe(false);
  });

  it("treats an unrecognized source IP as untrusted, but still parses the event (signature is the real authority)", () => {
    const result = paystackPaymentProvider.parseWebhook({
      body: { event: "charge.success", data: { reference: "ref-1", id: 123, status: "success" } },
      sourceIp: "1.2.3.4",
    });
    expect(result.recognized).toBe(true);
    if (result.recognized) expect(result.sourceIpTrusted).toBe(false);
  });
});

describe("Ghana Mobile Money provider-code mapping — confirmed against Paystack's current official Payment Channels documentation (2026-08-18)", () => {
  it("exposes exactly the confirmed codes: mtn / atl / vod", () => {
    expect(PAYSTACK_MOMO_PROVIDER_CODES).toEqual({ MTN: "mtn", AT: "atl", TELECEL: "vod" });
  });

  it.each([
    ["MTN", "mtn"],
    ["AT", "atl"],
    ["TELECEL", "vod"],
  ] as const)("sends provider=%s as \"%s\" to Paystack's Charge API, never leaking the code elsewhere", async (network, code) => {
    createCharge.mockResolvedValueOnce({ ok: true, data: { status: true, message: "", data: { reference: "ref-1", status: "pay_offline" } } });
    await paystackPaymentProvider.initiate({
      reference: "ref-1",
      amount: 10,
      currency: "GHS",
      network,
      phone: "0244123456",
      customerEmail: "customer@example.com",
    });
    expect(createCharge).toHaveBeenCalledWith(expect.objectContaining({ mobile_money: expect.objectContaining({ provider: code }) }));
  });
});
