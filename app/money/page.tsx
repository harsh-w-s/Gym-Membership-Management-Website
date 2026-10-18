import type { Metadata } from "next";
import Link from "next/link";
import { MoneyChart } from "@/components/MoneyChart";
import { MonthNav } from "@/components/MonthNav";
import { formatMonth, monthEndISO, monthStartISO, parseMonthParam, todayISO } from "@/lib/dates";
import { getBreakdown, getMonthChecklist, getMonthlyTotals } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type ExpenseCategory, type PaymentMethod } from "@/lib/types";

export const metadata: Metadata = { title: "Money" };
export const dynamic = "force-dynamic";

/** Renewals still due between today and the end of this month, valued at their package's current price. */
async function getUpcomingRenewals(today: string) {
  const supabase = getSupabase();
  const [{ data: clients, error }, { data: packages }] = await Promise.all([
    supabase
      .from("clients")
      .select("package_name")
      .gte("expiry_date", today)
      .lte("expiry_date", monthEndISO(today))
      .limit(1000)
      .overrideTypes<{ package_name: string }[], { merge: false }>(),
    supabase.from("packages").select("name, price").overrideTypes<{ name: string; price: number }[], { merge: false }>(),
  ]);
  if (error) throw new Error(`Failed to load renewals: ${error.message}`);

  const price = new Map((packages ?? []).map((p) => [p.name.toLowerCase(), p.price]));
  const list = clients ?? [];
  return {
    count: list.length,
    value: list.reduce((s, c) => s + (price.get(c.package_name.trim().toLowerCase()) ?? 0), 0),
  };
}

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const month = parseMonthParam(sp.month, today);
  const isCurrent = month === monthStartISO(today);

  const [summary, history, checklist, upcoming] = await Promise.all([
    getBreakdown(month, monthEndISO(month)),
    getMonthlyTotals(month, 6),
    getMonthChecklist(month),
    isCurrent ? getUpcomingRenewals(today) : Promise.resolve(null),
  ]);

  const profit = summary.revenue - summary.expenses;
  const unpaidBills = checklist.filter((i) => !i.paid);
  const unpaidBillsTotal = unpaidBills.reduce((s, i) => s + i.amount, 0);
  const projected = upcoming ? summary.revenue + upcoming.value - summary.expenses - unpaidBillsTotal : null;

  const methods = (Object.entries(summary.by_method) as [PaymentMethod, number][]).sort((a, b) => b[1] - a[1]);
  const categories = (Object.entries(summary.by_category) as [ExpenseCategory, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Money</h1>
          <p className="mt-1 text-sm text-slate-500">Money in from members, money out on expenses, and what&apos;s left.</p>
        </div>
        <MonthNav basePath="/money" month={month} today={today} />
      </header>

      {/* Headline numbers */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={`Summary for ${formatMonth(month)}`}>
        <Tile label="Money in" value={formatMoney(summary.revenue)} hint={`${summary.payments} payment${summary.payments === 1 ? "" : "s"}`} />
        <Tile label="Money out" value={formatMoney(summary.expenses)} hint={<Link href={`/expenses?month=${month.slice(0, 7)}`} className="hover:underline">See expenses →</Link>} />
        <Tile
          label={profit >= 0 ? "Profit" : "Loss"}
          value={`${profit < 0 ? "−" : ""}${formatMoney(Math.abs(profit))}`}
          hint={profit >= 0 ? "▲ Money in minus money out" : "▼ Spent more than came in"}
          emphasis={profit >= 0 ? "good" : "bad"}
        />
        <Tile
          label="Pending dues"
          value={formatMoney(summary.dues_total)}
          hint={
            summary.dues_count > 0 ? (
              <Link href="/clients?payment=due&sort=due_desc" className="hover:underline">
                {summary.dues_count} client{summary.dues_count === 1 ? "" : "s"} owe money →
              </Link>
            ) : (
              "Nobody owes anything"
            )
          }
        />
      </section>

      {/* Rest-of-month outlook (current month only) */}
      {upcoming && (
        <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <h2 className="text-sm font-semibold text-sky-900">Rest of this month</h2>
          <div className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-sky-800">Could still come in</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(upcoming.value)}</p>
              <p className="text-xs text-sky-800">
                {upcoming.count} membership{upcoming.count === 1 ? "" : "s"} expire before month end,{" "}
                <Link href="/clients?status=expiring&sort=expiry_asc" className="underline">
                  remind them
                </Link>
              </p>
            </div>
            <div>
              <p className="text-sky-800">Bills still to pay</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(unpaidBillsTotal)}</p>
              <p className="text-xs text-sky-800">
                {unpaidBills.length} unpaid{unpaidBills.some((b) => b.amount === 0) ? " (some amounts vary)" : ""} ·{" "}
                <Link href="/expenses" className="underline">
                  checklist
                </Link>
              </p>
            </div>
            <div>
              <p className="text-sky-800">If everyone renews</p>
              <p className="text-lg font-semibold text-slate-900">
                {projected! < 0 ? "−" : ""}
                {formatMoney(Math.abs(projected!))} {projected! >= 0 ? "profit" : "loss"}
              </p>
              <p className="text-xs text-sky-800">Best case for {formatMonth(month)}. Real forecasts come once there&apos;s more history.</p>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Money in vs out · last 6 months" className="lg:col-span-2">
          <MoneyChart data={history.map((h) => ({ label: formatMonth(h.month, true), revenue: h.revenue, expenses: h.expenses }))} />
        </Card>

        <Card title="How members paid">
          <BarList
            empty="No payments this month."
            rows={methods.map(([m, total]) => ({ label: PAYMENT_METHODS[m], total }))}
            total={summary.revenue}
          />
        </Card>

        <Card
          title="Who collected the money"
          subtitle="Compare with the cash in the drawer and the UPI statement. A gap here is where money goes missing."
        >
          <BarList
            empty="No payments this month."
            rows={summary.by_receiver.map((r) => ({ label: r.name, total: r.total, extra: `${r.count} payment${r.count === 1 ? "" : "s"}` }))}
            total={summary.revenue}
          />
        </Card>

        <Card title="Where the money went" className="lg:col-span-2">
          <BarList
            empty="No expenses this month."
            rows={categories.map(([c, total]) => ({ label: EXPENSE_CATEGORIES[c], total }))}
            total={summary.expenses}
            color="#eb6834"
          />
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, hint, emphasis }: { label: string; value: string; hint?: React.ReactNode; emphasis?: "good" | "bad" }) {
  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        emphasis === "good" ? "border-emerald-200" : emphasis === "bad" ? "border-red-200" : "border-slate-200"
      }`}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Card({ title, subtitle, className = "", children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Single-series horizontal bars (one hue): share of the total, value labelled in text ink. */
function BarList({
  rows,
  total,
  empty,
  color = "#2a78d6", // money in (blue); money out uses orange, matching the chart
}: {
  rows: { label: string; total: number; extra?: string }[];
  total: number;
  empty: string;
  color?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = total > 0 ? (r.total / total) * 100 : 0;
        return (
          <li key={r.label}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-slate-700">
                {r.label}
                {r.extra && <span className="ml-1.5 text-xs text-slate-400">{r.extra}</span>}
              </span>
              <span className="tabular-nums text-slate-900">
                {formatMoney(r.total)} <span className="text-xs text-slate-400">{Math.round(pct)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
