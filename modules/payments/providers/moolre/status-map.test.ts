import { describe, expect, it } from "vitest";
import { mapInitiateResponse, mapStatusResponse } from "./status-map";
import type { MoolreInitiateResponse, MoolreStatusResponse } from "./types";

describe("mapInitiateResponse — real documented Moolre response shapes", () => {
  it("maps TR099 (accepted for async processing) to ACCEPTED", () => {
    const res: MoolreInitiateResponse = { status: 1, code: "TR099", message: null, data: "abc-123-uuid" };
    const outcome = mapInitiateResponse(res);
    expect(outcome.outcome).toBe("ACCEPTED");
    if (outcome.outcome === "ACCEPTED") expect(outcome.providerReference).toBe("abc-123-uuid");
  });

  it("maps TP14 (OTP required) to OTP_REQUIRED", () => {
    const res: MoolreInitiateResponse = { status: 1, code: "TP14", message: "Please complete the verification process sent to you via SMS and try again.", data: "all" };
    const outcome = mapInitiateResponse(res);
    expect(outcome.outcome).toBe("OTP_REQUIRED");
  });

  it("maps TP17 (phone verification successful after OTP) to ACCEPTED, never REJECTED — verification success is not payment success", () => {
    const res: MoolreInitiateResponse = { status: 1, code: "TP17", message: "Phone no. Verification Successful.", data: null };
    const outcome = mapInitiateResponse(res);
    expect(outcome.outcome).toBe("ACCEPTED");
    expect(outcome.outcome).not.toBe("REJECTED");
  });

  it("TP17's providerReference is always null, even when the raw response echoes Moolre's shared 'all' placeholder — never mistaken for a genuine per-transaction id", () => {
    // Empirically confirmed against the real sandbox: TP17's `data` field
    // is the same non-unique placeholder string TP14 uses ("all"), not a
    // transaction identifier. Storing it as one caused a real
    // cross-Order unique-constraint collision on Payment.providerEventId.
    const res: MoolreInitiateResponse = { status: 1, code: "TP17", message: "Phone no. Verification Successful.", data: "all" };
    const outcome = mapInitiateResponse(res);
    expect(outcome.outcome).toBe("ACCEPTED");
    if (outcome.outcome === "ACCEPTED") {
      expect(outcome.providerReference).toBeNull();
    }
  });

  it("maps TP13 (duplicate external reference) to REJECTED, never treated as retryable", () => {
    const res: MoolreInitiateResponse = { status: "0", code: "TP13", message: "External Reference is required and must be unique.", data: "externalref" };
    const outcome = mapInitiateResponse(res);
    expect(outcome.outcome).toBe("REJECTED");
  });

  it("maps an unrecognized code to REJECTED with safe, non-provider-leaking copy", () => {
    const res: MoolreInitiateResponse = { status: "0", code: "XX99", message: "Some internal detail", data: null };
    const outcome = mapInitiateResponse(res);
    expect(outcome.outcome).toBe("REJECTED");
    if (outcome.outcome === "REJECTED") {
      expect(outcome.reasonSafe).not.toContain("Some internal detail");
    }
  });
});

describe("mapStatusResponse — honest gap: only SS01+txstatus=1 is a confirmed success", () => {
  const successData = {
    txstatus: 1,
    txtype: 2,
    accountnumber: "100000100002",
    payer: "",
    payee: "0209151872",
    amount: "1",
    value: "1",
    transactionid: "31772290",
    externalref: "1231231-128",
    thirdpartyref: "471700539041",
    ts: "2023-11-21 03:57:25",
  };

  it("maps SS01 + txstatus=1 to SUCCEEDED with the verified amount/currency/reference", () => {
    const res: MoolreStatusResponse = { status: 1, code: "SS01", message: "Transaction Successful", data: successData };
    const outcome = mapStatusResponse(res);
    expect(outcome.status).toBe("SUCCEEDED");
    if (outcome.status === "SUCCEEDED") {
      expect(outcome.providerReference).toBe("31772290");
      expect(outcome.verifiedAmount).toBe(1);
      expect(outcome.verifiedCurrency).toBe("GHS");
    }
  });

  it("never maps an unrecognized code to SUCCEEDED or FAILED — stays PENDING (no documented enum to invent)", () => {
    const res: MoolreStatusResponse = { status: 1, code: "SS02", message: "Some other status", data: null };
    const outcome = mapStatusResponse(res);
    expect(outcome.status).toBe("PENDING");
  });

  it("maps ST09 (transaction not found) to UNKNOWN, never FAILED", () => {
    const res: MoolreStatusResponse = { status: "0", code: "ST09", message: "Transactions not Found", data: null };
    const outcome = mapStatusResponse(res);
    expect(outcome.status).toBe("UNKNOWN");
  });

  it("never reports SUCCEEDED when txstatus is present but not 1, even with code SS01", () => {
    const res: MoolreStatusResponse = { status: 1, code: "SS01", message: null, data: { ...successData, txstatus: 0 } };
    const outcome = mapStatusResponse(res);
    expect(outcome.status).not.toBe("SUCCEEDED");
  });
});
