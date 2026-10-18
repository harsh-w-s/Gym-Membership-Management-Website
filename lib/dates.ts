const GYM_TIMEZONE = process.env.GYM_TIMEZONE || "Asia/Kolkata";

/** Today's date as YYYY-MM-DD in the gym's timezone (not the server's, which is usually UTC). */
export function todayISO(): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: GYM_TIMEZONE }).format(new Date());
}

/** Adds days to a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Adds calendar months, clamping to the month's last day:
 * 2026-01-31 + 1 month -> 2026-02-28.
 */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Last valid day of a membership: 18 Oct + 1 month -> 17 Nov
 * (the member can train every day up to and including that date).
 */
export function membershipEndDate(startISO: string, months: number): string {
  return addDaysISO(addMonthsISO(startISO, months), -1);
}

/** "2026-10-17" -> "17 Oct 2026". Parsed as UTC so it never shifts a day. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** "2026-10-18" -> "2026-10-01". */
export function monthStartISO(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Last day of the month: "2026-02-10" -> "2026-02-28". */
export function monthEndISO(iso: string): string {
  return addDaysISO(addMonthsISO(monthStartISO(iso), 1), -1);
}

/** Reads a "YYYY-MM" URL param; falls back to the current month. Returns the 1st of that month. */
export function parseMonthParam(value: unknown, today: string): string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : monthStartISO(today);
}

/** "2026-10-01" -> "October 2026" (or "Oct" with short=true). */
export function formatMonth(iso: string, short = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(new Date(`${iso.slice(0, 7)}-01T00:00:00Z`));
}
