import type { Metadata } from "next";
import Link from "next/link";
import { primaryBtn, secondaryBtn } from "@/components/form";
import { MonthNav } from "@/components/MonthNav";
import { formatDate, monthEndISO, monthStartISO, parseMonthParam, todayISO } from "@/lib/dates";
import { getMonthChecklist } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type Expense, type ExpenseCategory } from "@/lib/types";

export const metadata: Metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

const FLASH: Record<string, string> = { saved: "Expense saved.", deleted: "Expense deleted." };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const month = parseMonthParam(sp.month, today);
  const category = typeof sp.category === "string" && sp.category in EXPENSE_CATEGORIES ? (sp.category as ExpenseCategory) : "";

  // Expenses dated within the chosen month (optionally one category), newest first.
  let query = getSupabase()
    .from("expenses")
    .select("*")
    .gte("spent_on", month)
    .lte("spent_on", monthEndISO(month))
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (category) query = query.eq("category", category);

  const [{ data, error }, checklist] = await Promise.all([query.overrideTypes<Expense[], { merge: false }>(), getMonthChecklist(month)]);
  if (error) throw new Error(`Failed to load expenses: ${error.message}`);

  const expenses = data ?? [];
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const unpaid = checklist.filter((i) => !i.paid);
  const flash = Object.keys(FLASH).find((k) => sp[k] === "1");
  const monthParam = month.slice(0, 7);
  const isCurrentMonth = month === monthStartISO(today);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">Money going out: bills, salaries, repairs and everything else.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/expenses/bills" className={secondaryBtn}>
            Monthly bills
          </Link>
          <Link href="/expenses/new" className={primaryBtn}>
            + Add Expense
          </Link>
        </div>
      </header>

      {flash && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {FLASH[flash]}
        </div>
      )}

      <MonthNav basePath="/expenses" month={month} today={today} params={category ? { category } : {}} />

      {/* ---------------- This month's bills checklist ---------------- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {isCurrentMonth ? "This month's bills" : "Bills for this month"}
            {checklist.length > 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${unpaid.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                {unpaid.length ? `${unpaid.length} due` : "All paid ✓"}
              </span>
            )}
          </h2>
          <Link href="/expenses/bills" className="text-sm font-medium text-emerald-700 hover:underline">
            Manage bills
          </Link>
        </div>
        {checklist.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No monthly bills yet. <Link href="/expenses/bills/new" className="font-medium text-emerald-700 underline">Add rent, internet etc.</Link>{" "}
            Trainer salaries appear here automatically once a salary is set.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {checklist.map((item) => {
              const payHref = `/expenses/new?${new URLSearchParams({
                [item.kind === "bill" ? "bill" : "trainer"]: item.id,
                month: monthParam,
              }).toString()}`;
              return (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500">
                      {item.amount > 0 ? formatMoney(item.amount) : "Amount varies"}
                      {item.dueDate && ` · due ${formatDate(item.dueDate)}`}
                    </div>
                  </div>
                  {item.paid ? (
                    <Link
                      href={`/expenses/${item.paid.expenseId}/edit`}
                      className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                    >
                      ✓ Paid {formatMoney(item.paid.amount)} on {formatDate(item.paid.spentOn)}
                    </Link>
                  ) : (
                    <Link href={payHref} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                      Mark paid
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------------- All expenses this month ---------------- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {category ? EXPENSE_CATEGORIES[category] : "All expenses"} · {formatMoney(total)}
          </h2>
          {/* Category filter as plain links so it works without JavaScript. */}
          <div className="flex flex-wrap gap-1 text-xs">
            <FilterLink href={`/expenses?month=${monthParam}`} active={!category} label="All" />
            {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
              <FilterLink key={key} href={`/expenses?month=${monthParam}&category=${key}`} active={category === key} label={label} />
            ))}
          </div>
        </div>
        {expenses.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No expenses recorded for this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="hidden px-4 py-2 sm:table-cell">Paid by</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2">{formatDate(e.spent_on)}</td>
                    <td className="px-4 py-2">{EXPENSE_CATEGORIES[e.category]}</td>
                    <td className="px-4 py-2 text-slate-600">{e.description ?? "—"}</td>
                    <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">{PAYMENT_METHODS[e.method]}</td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{formatMoney(e.amount)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/expenses/${e.id}/edit`} className="font-medium text-emerald-700 hover:text-emerald-800">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-2.5 py-1 font-medium ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
    >
      {label}
    </Link>
  );
}
