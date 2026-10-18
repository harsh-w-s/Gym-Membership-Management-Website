import type { Metadata } from "next";
import Link from "next/link";
import { createExpense } from "@/app/expenses/actions";
import { ExpenseForm, type ExpensePreset } from "@/components/ExpenseForms";
import { formatMonth, parseMonthParam, todayISO } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase/server";
import type { RecurringBill } from "@/lib/types";

export const metadata: Metadata = { title: "Add Expense" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayISO();
  const month = parseMonthParam(sp.month, today);
  const supabase = getSupabase();

  // Arriving from "Mark paid" on the bills checklist: pre-fill from the bill or trainer.
  let preset: ExpensePreset | undefined;
  if (typeof sp.bill === "string" && UUID.test(sp.bill)) {
    const { data: bill } = await supabase.from("recurring_bills").select("*").eq("id", sp.bill).maybeSingle<RecurringBill>();
    if (bill) {
      preset = {
        category: bill.category,
        description: `${bill.name} · ${formatMonth(month)}`,
        amount: bill.amount,
        recurring_bill_id: bill.id,
        bill_month: month,
      };
    }
  } else if (typeof sp.trainer === "string" && UUID.test(sp.trainer)) {
    const { data: trainer } = await supabase
      .from("trainers")
      .select("id, name, salary")
      .eq("id", sp.trainer)
      .maybeSingle<{ id: string; name: string; salary: number }>();
    if (trainer) {
      preset = {
        category: "salary",
        description: `Salary · ${trainer.name} · ${formatMonth(month)}`,
        amount: trainer.salary,
        trainer_id: trainer.id,
        bill_month: month,
      };
    }
  }

  const back = `/expenses?month=${month.slice(0, 7)}`;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={back} className="text-sm text-slate-500 hover:text-slate-800">
        ← Expenses
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{preset ? "Mark bill as paid" : "Add Expense"}</h1>
        {preset && <p className="mt-1 text-sm text-slate-500">Check the amount (it may differ this month) and save.</p>}
      </header>
      <ExpenseForm action={createExpense} today={today} preset={preset} cancelHref={back} />
    </div>
  );
}
