import { env } from "../../../../lib/env";
import type { MoolreInitiateResponse, MoolreStatusResponse } from "./types";

const BASE_URLS = {
  sandbox: "https://sandbox.moolre.com",
  production: "https://api.moolre.com",
} as const;

const TIMEOUT_MS = 15_000;

export type MoolreHttpResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "TIMEOUT" | "NETWORK" | "HTTP_ERROR" | "PARSE_ERROR"; status?: number; raw?: unknown };

/**
 * Owns HTTP transport, auth headers, base-URL selection, timeouts, and raw
 * response parsing only — no CrownSourceGlobal domain concepts here, and no
 * outcome interpretation (see status-map.ts for that). Every call is
 * explicitly timed out; a timeout is surfaced distinctly from a network
 * failure or an HTTP error, never silently treated as either success or
 * failure by the caller.
 */
async function moolreRequest<T>(
  path: string,
  body: Record<string, unknown>,
  headerSet: "transact" | "account",
): Promise<MoolreHttpResult<T>> {
  const base = BASE_URLS[env.MOOLRE_ENV];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-USER": env.MOOLRE_API_USER ?? "",
  };
  if (headerSet === "transact") {
    headers["X-API-PUBKEY"] = env.MOOLRE_API_PUBKEY ?? "";
  } else {
    headers["X-API-KEY"] = env.MOOLRE_API_KEY ?? "";
  }

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, kind: "PARSE_ERROR", status: res.status };
    }

    if (!res.ok) {
      return { ok: false, kind: "HTTP_ERROR", status: res.status, raw: json };
    }
    return { ok: true, data: json as T };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, kind: "TIMEOUT" };
    }
    return { ok: false, kind: "NETWORK" };
  } finally {
    clearTimeout(timeout);
  }
}

export const moolreClient = {
  initiatePayment(body: {
    type: 1;
    channel: string;
    currency: "GHS";
    payer: string;
    amount: string;
    externalref: string;
    accountnumber: string;
    otpcode?: string;
  }) {
    return moolreRequest<MoolreInitiateResponse>("/open/transact/payment", body, "transact");
  },
  getStatus(body: { type: 1; idtype: 1; id: string; accountnumber: string }) {
    return moolreRequest<MoolreStatusResponse>("/open/transact/status", body, "transact");
  },
};
