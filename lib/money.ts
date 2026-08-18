/**
 * GHS ⇄ pesewas (minor unit) conversion — Paystack's documented amount
 * unit for GHS, matching kobo's role for NGN. Deliberately avoids
 * multiplying a fractional GHS amount directly (a floating-point
 * multiplication risk); operates on the fixed 2-decimal string instead.
 */
export function ghsToPesewas(amountGHS: number): number {
  const fixed = amountGHS.toFixed(2);
  const [whole, fraction] = fixed.split(".");
  return Number(whole) * 100 + Number(fraction);
}

export function pesewasToGhs(pesewas: number): number {
  return pesewas / 100;
}
