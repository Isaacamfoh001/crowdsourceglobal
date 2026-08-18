/**
 * Ghana phone number handling for Moolre Mobile Money (M10A). Moolre's
 * Collection API requires the local 0-prefixed format (e.g. "024...") — NOT
 * "+233..."/"233...". We accept reasonable customer input and normalize
 * server-side; the normalized/raw value is only ever used transiently in a
 * provider request and is never persisted (only a masked form is stored).
 */

/** Returns the local 0XXXXXXXXX form, or null if the input isn't a plausible Ghana mobile number. */
export function normalizeGhanaPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  let local: string | null = null;
  if (digits.length === 10 && digits.startsWith("0")) {
    local = digits;
  } else if (digits.length === 12 && digits.startsWith("233")) {
    local = `0${digits.slice(3)}`;
  } else if (digits.length === 9) {
    local = `0${digits}`;
  }

  if (!local || !/^0\d{9}$/.test(local)) return null;
  return local;
}

/** "024 *** 1234" style — the only phone representation ever persisted or logged. */
export function maskGhanaPhone(local: string): string {
  if (!/^0\d{9}$/.test(local)) return "*** *** ****";
  return `${local.slice(0, 3)} *** ${local.slice(6)}`;
}
