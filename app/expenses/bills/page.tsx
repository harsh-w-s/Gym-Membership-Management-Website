import type { Metadata } from "next";
import Link from "next/link";
import { primaryBtn } from "@/components/form";
import { formatMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES, type RecurringBill } from "@/lib/types";

export const metadata: Metadata = { title: "Monthly Bills" };
export const dynamic = "force-dynamic";

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { data, error } = await getSupabase()
    .from("recurring_bills")
    .select("*")
    .order("is_active", { ascending: false })
    .order("due_day")
    .overrideTypes<RecurringBill[], { merge: false }>();
  if (error) throw new Error(`Failed to load bills: ${error.message}`);
  const bills = data ?? [];
  const monthlyTotal = bills.filter((b) => b.is_active).reduce((s, b) => s + b.amount, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/expenses" className="text-sm text-slate-500 hover:text-slate-800">
        ← Expenses
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monthly Bills</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bills that come every month. They appear in the Expenses checklist each month with a &quot;Mark paid&quot; button.
            Trainer salaries are added automatically from the Trainers page.
          </p>
        </div>
        <Link href="/expenses/bills/new" className={primaryBtn}>
          + Add Bill
        </Link>
      </header>

      {(sp.saved === "1" || sp.deleted === "1") && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.deleted === "1" ? "Bill deleted. Past payments of it are kept." : "Bill saved."}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {bills.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No bills yet. Start with rent, electricity and internet.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {bills.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${b.is_active ? "text-slate-900" : "text-slate-400"}`}>{b.name}</span>
                      {!b.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Paused</span>}
                    </div>
                    <div className="text-sm text-slate-500">
                      {EXPENSE_CATEGORIES[b.category]} · {b.amount > 0 ? formatMoney(b.amount) : "amount varies"} · due on day {b.due_day}
                    </div>
                  </div>
                  <Link href={`/expenses/bills/${b.id}/edit`} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
              Fixed bills per month (excluding salaries and bills that vary): <strong>{formatMoney(monthlyTotal)}</strong>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
