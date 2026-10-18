"use client";

import { useState } from "react";

type Point = { label: string; revenue: number; expenses: number };

// Categorical slots 1-2 from the dataviz reference palette (validated:
// CVD ΔE 24.7, normal ΔE 33.6, both ≥3:1 on white). Deliberately not
// green/red, which would read as good/bad status rather than identity.
const REVENUE = "#2a78d6";
const EXPENSES = "#eb6834";

/** Rounds the axis max up to a friendly number, without wasting more than ~25% headroom. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * pow >= v) ?? 10;
  return step * pow;
}

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** Revenue vs expenses per month: grouped bars, hover tooltip, legend and table view. */
export function MoneyChart({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const max = niceMax(Math.max(...data.flatMap((d) => [d.revenue, d.expenses])));
  const ticks = [0, max / 2, max];

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: REVENUE }} /> Money in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: EXPENSES }} /> Money out
        </span>
      </div>

      <div className="relative flex h-56 gap-2 pl-10">
        {/* Recessive grid + y-axis labels */}
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute left-10 right-0 border-t border-slate-100" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -left-10 -translate-y-1/2 text-[10px] tabular-nums text-slate-400">{compact.format(t)}</span>
          </div>
        ))}

        {data.map((d, i) => {
          const profit = d.revenue - d.expenses;
          return (
            <button
              key={d.label}
              type="button"
              className="group relative flex flex-1 items-end justify-center gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${d.label}: money in ${money.format(d.revenue)}, money out ${money.format(d.expenses)}, ${profit >= 0 ? "profit" : "loss"} ${money.format(Math.abs(profit))}`}
            >
              {/* Hover highlight spans the full column, a bigger hit target than the bars. */}
              <span className={`absolute inset-0 rounded-md ${active === i ? "bg-slate-50" : ""}`} aria-hidden />
              <span
                className="relative w-1/3 max-w-6 rounded-t-[4px]"
                style={{ height: `${(d.revenue / max) * 100}%`, background: REVENUE, minHeight: d.revenue > 0 ? 2 : 0 }}
                aria-hidden
              />
              <span
                className="relative w-1/3 max-w-6 rounded-t-[4px]"
                style={{ height: `${(d.expenses / max) * 100}%`, background: EXPENSES, minHeight: d.expenses > 0 ? 2 : 0 }}
                aria-hidden
              />
              {active === i && (
                <span
                  role="tooltip"
                  // Beside the column (not above it) so it stays inside the card and
                  // never covers the bars it describes: right of early months, left of late ones.
                  className={`pointer-events-none absolute top-0 z-10 w-44 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs shadow-lg ${
                    i < data.length / 2 ? "left-full ml-1" : "right-full mr-1"
                  }`}
                >
                  <span className="mb-1 block font-semibold text-slate-900">{d.label}</span>
                  <span className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: REVENUE }} /> In
                    </span>
                    <span className="tabular-nums text-slate-900">{money.format(d.revenue)}</span>
                  </span>
                  <span className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: EXPENSES }} /> Out
                    </span>
                    <span className="tabular-nums text-slate-900">{money.format(d.expenses)}</span>
                  </span>
                  <span className="mt-1 flex justify-between border-t border-slate-100 pt-1 font-medium text-slate-900">
                    <span>{profit >= 0 ? "▲ Profit" : "▼ Loss"}</span>
                    <span className="tabular-nums">{money.format(Math.abs(profit))}</span>
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 pl-10 text-center text-xs text-slate-500" aria-hidden>
        {data.map((d) => (
          <span key={d.label} className="flex-1">
            {d.label}
          </span>
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800">Show as table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">Month</th>
              <th className="py-1 text-right">Money in</th>
              <th className="py-1 text-right">Money out</th>
              <th className="py-1 text-right">Profit / loss</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-800">
            {data.map((d) => (
              <tr key={d.label} className="border-t border-slate-100">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right">{money.format(d.revenue)}</td>
                <td className="py-1 text-right">{money.format(d.expenses)}</td>
                <td className="py-1 text-right">{(d.revenue - d.expenses < 0 ? "−" : "") + money.format(Math.abs(d.revenue - d.expenses))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
