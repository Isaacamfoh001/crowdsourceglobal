import { describe, expect, it } from "vitest";
import { mapChargeResponse, mapInitializeResponse, mapVerifyResponse } from "./status-map";
import type { PaystackChargeResponse, PaystackInitializeResponse, PaystackVerifyResponse } from "./types";

describe("mapChargeResponse — real documented Paystack Charge API response shapes", () => {
  it("maps pay_offline (MTN/AirtelTigo authorization required) to ACCEPTED", () => {
    const res: PaystackChargeResponse = {
      status: true,
      message: "Charge attempted",
      data: { reference: "8nn5fqljd0suybr", status: "pay_offline", display_text: "Please complete authorization process on your mobile phone" },
    };
    const outcome = mapChargeResponse(res);
    expect(outcome.outcome).toBe("ACCEPTED");
  });

  it("maps send_otp to OTP_REQUIRED", () => {
    const res: PaystackChargeResponse = { status: true, message: "Charge attempted", data: { reference: "ref-1", status: "send_otp" } };
    const outcome = mapChargeResponse(res);
    expect(outcome.outcome).toBe("OTP_REQUIRED");
  });

  it("maps a charge-time success to ACCEPTED, never a bypass of independent verification", () => {
    const res: PaystackChargeResponse = { status: true, message: "Charge attempted", data: { reference: "ref-2", status: "success", id: 2009945086 } };
    const outcome = mapChargeResponse(res);
    expect(outcome.outcome).toBe("ACCEPTED");
    if (outcome.outcome === "ACCEPTED") expect(outcome.providerReference).toBe("2009945086");
  });

  it("maps failed to REJECTED", () => {
    const res: PaystackChargeResponse = { status: false, message: "Charge attempted", data: { reference: "ref-3", status: "failed" } };
    const outcome = mapChargeResponse(res);
    expect(outcome.outcome).toBe("REJECTED");
  });
});

describe("mapVerifyResponse — real documented Verify Transaction response shapes", () => {
  it("maps success to SUCCEEDED with GHS-converted amount (minor units → major)", () => {
    const res: PaystackVerifyResponse = {
      status: true,
      message: "Verification successful",
      data: { id: 2009945086, status: "success", reference: "rd0bz6z2wu", amount: 20000, currency: "GHS" },
    };
    const outcome = mapVerifyResponse(res);
    expect(outcome.status).toBe("SUCCEEDED");
    if (outcome.status === "SUCCEEDED") {
      expect(outcome.verifiedAmount).toBe(200);
      expect(outcome.verifiedCurrency).toBe("GHS");
      expect(outcome.providerReference).toBe("2009945086");
    }
  });

  it("maps failed to FAILED", () => {
    const res: PaystackVerifyResponse = { status: true, message: "", data: { id: 1, status: "failed", reference: "r", amount: 100, currency: "GHS" } };
    expect(mapVerifyResponse(res).status).toBe("FAILED");
  });

  it("maps abandoned to FAILED — a definitive terminal outcome, safe to let the customer retry from", () => {
    const res: PaystackVerifyResponse = { status: true, message: "", data: { id: 1, status: "abandoned", reference: "r", amount: 100, currency: "GHS" } };
    expect(mapVerifyResponse(res).status).toBe("FAILED");
  });

  it("never maps reversed or an unrecognized status to SUCCEEDED or FAILED — stays PENDING", () => {
    const reversed: PaystackVerifyResponse = { status: true, message: "", data: { id: 1, status: "reversed", reference: "r", amount: 100, currency: "GHS" } };
    expect(mapVerifyResponse(reversed).status).toBe("PENDING");

    const unknown: PaystackVerifyResponse = { status: true, message: "", data: { id: 1, status: "some-new-code", reference: "r", amount: 100, currency: "GHS" } };
    expect(mapVerifyResponse(unknown).status).toBe("PENDING");
  });

  it("card payments (M10B): a success carrying an authorization object surfaces safe brand/last4 display, never the PAN/CVV/PIN/OTP", () => {
    const res: PaystackVerifyResponse = {
      status: true,
      message: "Verification successful",
      data: {
        id: 3009945086,
        status: "success",
        reference: "card-ref-1",
        amount: 850000,
        currency: "GHS",
        authorization: { last4: "4081", card_type: "visa", bank: "Test Bank" },
      },
    };
    const outcome = mapVerifyResponse(res);
    expect(outcome.status).toBe("SUCCEEDED");
    if (outcome.status === "SUCCEEDED") {
      expect(outcome.cardDisplay).toEqual({ brand: "visa", last4: "4081" });
    }
  });

  it("mobile money payments (no authorization object) never fabricate a cardDisplay", () => {
    const res: PaystackVerifyResponse = {
      status: true,
      message: "Verification successful",
      data: { id: 2009945086, status: "success", reference: "momo-ref-1", amount: 20000, currency: "GHS" },
    };
    const outcome = mapVerifyResponse(res);
    expect(outcome.status).toBe("SUCCEEDED");
    if (outcome.status === "SUCCEEDED") {
      expect(outcome.cardDisplay).toBeNull();
    }
  });
});

describe("mapInitializeResponse — real documented Transaction Initialize response shapes (M10B, card/hosted Checkout)", () => {
  it("maps a successful initialize call to REDIRECT with the hosted-Checkout URL", () => {
    const res: PaystackInitializeResponse = {
      status: true,
      message: "Authorization URL created",
      data: { authorization_url: "https://checkout.paystack.com/0peioxfyra", access_code: "0peioxfyra", reference: "card-ref-1" },
    };
    const outcome = mapInitializeResponse(res);
    expect(outcome.outcome).toBe("REDIRECT");
    if (outcome.outcome === "REDIRECT") {
      expect(outcome.authorizationUrl).toBe("https://checkout.paystack.com/0peioxfyra");
    }
  });

  it("maps a failed/rejected initialize call to REJECTED, never a fabricated redirect", () => {
    const res = { status: false, message: "Invalid key", data: {} } as unknown as PaystackInitializeResponse;
    const outcome = mapInitializeResponse(res);
    expect(outcome.outcome).toBe("REJECTED");
  });
});
