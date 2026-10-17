const CURRENCY = process.env.GYM_CURRENCY || "INR";

const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatMoney(amount: number): string {
  return formatter.format(amount);
}

/**
 * Parses a money input ("1,500", "1500.50") into a number with at most
 * 2 decimals. Returns null for empty input, NaN for invalid input.
 */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[,\s₹]/g, "");
  if (cleaned === "") return null;
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(cleaned)) return NaN;
  return Number(cleaned);
}
