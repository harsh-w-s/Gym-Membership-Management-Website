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

/** "2026-10-17" -> "17 Oct 2026". Parsed as UTC so it never shifts a day. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}
