import Link from "next/link";
import { addMonthsISO, formatMonth, monthStartISO } from "@/lib/dates";

/** ← October 2026 → switcher. Keeps other query params (e.g. category). */
export function MonthNav({
  basePath,
  month,
  today,
  params = {},
}: {
  basePath: string;
  month: string; // 1st of the month
  today: string;
  params?: Record<string, string>;
}) {
  const href = (m: string) => {
    const q = new URLSearchParams({ ...params, month: m.slice(0, 7) });
    return `${basePath}?${q.toString()}`;
  };
  const prev = addMonthsISO(month, -1);
  const next = addMonthsISO(month, 1);
  const isCurrent = month === monthStartISO(today);
  const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50";

  return (
    <nav className="flex items-center gap-2" aria-label="Choose month">
      <Link href={href(prev)} className={btn} aria-label={`Previous month (${formatMonth(prev)})`}>
        ←
      </Link>
      <span className="min-w-36 text-center font-semibold">{formatMonth(month)}</span>
      {/* No browsing into future months. */}
      {next <= monthStartISO(today) ? (
        <Link href={href(next)} className={btn} aria-label={`Next month (${formatMonth(next)})`}>
          →
        </Link>
      ) : (
        <span className={`${btn} pointer-events-none opacity-40`} aria-hidden>
          →
        </span>
      )}
      {!isCurrent && (
        <Link href={href(today)} className="text-sm font-medium text-emerald-700 hover:underline">
          This month
        </Link>
      )}
    </nav>
  );
}
