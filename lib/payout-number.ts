const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity — matches lib/order-number.ts

function randomSuffix(length: number): string {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return result;
}

/**
 * CrownSourceGlobal's own reference for one automated payout ATTEMPT
 * (modules/vendor-finance) — sent to Paystack as `reference`, and the key
 * used to independently re-verify status later. Generated fresh on every
 * "Send Payout"/"Retry Payout" click, never reused across attempts — a
 * FAILED attempt is a known dead end and Paystack references must be
 * unique per transfer.
 */
export function generatePayoutReference(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `PYT-${y}${m}${d}-${randomSuffix(5)}`;
}
