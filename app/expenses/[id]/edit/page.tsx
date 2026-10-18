import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteExpense, updateExpense } from "@/app/expenses/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { ExpenseForm } from "@/components/ExpenseForms";
import { formatDate, formatMonth, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import type { Expense } from "@/lib/types";

export const metadata: Metadata = { title: "Edit Expense" };
export const dynamic = "force-dynamic";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: expense, error } = await getSupabase().from("expenses").select("*").eq("id", id).maybeSingle<Expense>();
  if (error) throw new Error(`Failed to load expense: ${error.message}`);
  if (!expense) notFound();

  const back = `/expenses?month=${expense.spent_on.slice(0, 7)}`;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={back} className="text-sm text-slate-500 hover:text-slate-800">
        ← Expenses
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Expense</h1>
          {expense.bill_month && (
            <p className="mt-1 text-sm text-slate-500">Pays the monthly bill for {formatMonth(expense.bill_month)}.</p>
          )}
        </div>
        <DeleteButton
          action={deleteExpense.bind(null, expense.id, expense.spent_on)}
          confirmText={`Delete the ${formatMoney(expense.amount)} expense from ${formatDate(expense.spent_on)}?${
            expense.bill_month ? " The bill will show as unpaid again." : ""
          }`}
        />
      </header>
      <ExpenseForm action={updateExpense.bind(null, expense.id)} today={todayISO()} expense={expense} cancelHref={back} />
    </div>
  );
}
