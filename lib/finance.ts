import "server-only";
import { addDaysISO, monthEndISO } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase/server";
import type { ExpenseCategory, PaymentMethod, RecurringBill } from "@/lib/types";

/** One row of the "This month's bills" checklist. */
export type ChecklistItem = {
  key: string;
  kind: "bill" | "salary";
  id: string; // recurring_bill id or trainer id
  name: string;
  category: ExpenseCategory;
  amount: number; // usual amount (0 = varies)
  dueDate: string | null;
  paid: { expenseId: string; amount: number; spentOn: string } | null;
};

/**
 * Builds the checklist for a month: every active recurring bill plus every
 * trainer with a salary, marked paid if an expense for that month exists.
 */
export async function getMonthChecklist(month: string): Promise<ChecklistItem[]> {
  const supabase = getSupabase();
  const [bills, trainers, paid] = await Promise.all([
    supabase.from("recurring_bills").select("*").eq("is_active", true).order("due_day").overrideTypes<RecurringBill[], { merge: false }>(),
    supabase
      .from("trainers")
      .select("id, name, salary")
      .gt("salary", 0)
      .order("name")
      .overrideTypes<{ id: string; name: string; salary: number }[], { merge: false }>(),
    // Expenses already linked to this month's bills/salaries.
    supabase
      .from("expenses")
      .select("id, amount, spent_on, category, recurring_bill_id, trainer_id")
      .eq("bill_month", month)
      .overrideTypes<
        { id: string; amount: number; spent_on: string; category: string; recurring_bill_id: string | null; trainer_id: string | null }[],
        { merge: false }
      >(),
  ]);
  const error = bills.error ?? trainers.error ?? paid.error;
  if (error) throw new Error(`Failed to load bills: ${error.message}`);

  const lastDay = Number(monthEndISO(month).slice(8));
  const toPaid = (e?: { id: string; amount: number; spent_on: string }) =>
    e ? { expenseId: e.id, amount: e.amount, spentOn: e.spent_on } : null;

  const billItems: ChecklistItem[] = (bills.data ?? []).map((b) => ({
    key: `bill-${b.id}`,
    kind: "bill",
    id: b.id,
    name: b.name,
    category: b.category,
    amount: b.amount,
    dueDate: addDaysISO(month, Math.min(b.due_day, lastDay) - 1),
    paid: toPaid(paid.data?.find((e) => e.recurring_bill_id === b.id)),
  }));

  const salaryItems: ChecklistItem[] = (trainers.data ?? []).map((t) => ({
    key: `salary-${t.id}`,
    kind: "salary",
    id: t.id,
    name: `Salary · ${t.name}`,
    category: "salary",
    amount: t.salary,
    dueDate: null,
    paid: toPaid(paid.data?.find((e) => e.category === "salary" && e.trainer_id === t.id)),
  }));

  return [...billItems, ...salaryItems];
}

export type FinanceBreakdown = {
  revenue: number;
  payments: number;
  expenses: number;
  by_method: Partial<Record<PaymentMethod, number>>;
  by_receiver: { name: string; total: number; count: number }[];
  by_category: Partial<Record<ExpenseCategory, number>>;
  dues_total: number;
  dues_count: number;
};

/** Totals for a date range, computed in Postgres (see finance_breakdown in the migration). */
export async function getBreakdown(from: string, to: string): Promise<FinanceBreakdown> {
  const { data, error } = await getSupabase().rpc("finance_breakdown", { p_from: from, p_to: to });
  if (error) throw new Error(`Failed to load finance summary: ${error.message}`);
  // numeric comes back as JSON numbers inside jsonb.
  return data as FinanceBreakdown;
}

export type MonthTotals = { month: string; revenue: number; expenses: number };

export async function getMonthlyTotals(month: string, months = 6): Promise<MonthTotals[]> {
  const { data, error } = await getSupabase().rpc("finance_monthly", { p_month: month, p_months: months });
  if (error) throw new Error(`Failed to load monthly totals: ${error.message}`);
  return ((data ?? []) as { month: string; revenue: number | string; expenses: number | string }[]).map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
    expenses: Number(r.expenses),
  }));
}
