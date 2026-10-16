/**
 * Normalises a phone number to the digits-only international format that
 * https://wa.me/<phone> requires: "+91 98765-43210" -> "919876543210".
 * Also drops a leading "00" international dialling prefix.
 */
export function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^00/, "");
}

/** E.164 allows at most 15 digits; 8 is a safe floor including country code. */
export function isValidIntlPhone(digits: string): boolean {
  return /^[1-9]\d{7,14}$/.test(digits);
}
