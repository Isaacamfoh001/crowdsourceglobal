const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity — matches lib/order-number.ts

function randomSuffix(length: number): string {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return result;
}

/** Human-readable, not guessable enough to matter — same convention as generateOrderNumber/generateResolutionCaseNumber. */
export function generateSettlementNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `SET-${y}${m}${d}-${randomSuffix(5)}`;
}
