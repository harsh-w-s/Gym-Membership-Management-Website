"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayISO } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type FormState } from "@/lib/types";
import { isISODate, UUID_RE } from "@/lib/validation";

export type ExpenseFormState = FormState;

const invalid = (fieldErrors: Record<string, string> | undefined): ExpenseFormState => ({
  status: "error",
  message: "Please fix the highlighted fields.",
  fieldErrors,
});

function parseExpenseForm(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const errors: Record<string, string> = {};

  const category = get("category");
  const description = get("description");
  const amount = parseMoney(get("amount"));
  const spentOn = get("spent_on");
  const method = get("method");
  // Present only when paying a monthly bill / salary from the checklist.
  const billId = get("recurring_bill_id");
  const trainerId = get("trainer_id");
  const billMonth = get("bill_month");

  if (!(category in EXPENSE_CATEGORIES)) errors.category = "Pick a category.";
  if (description.length > 200) errors.description = "Keep it under 200 characters.";
  if (amount === null || Number.isNaN(amount) || amount <= 0) errors.amount = "Enter the amount spent, e.g. 4200.";
  if (!isISODate(spentOn)) errors.spent_on = "Pick a valid date.";
  else if (spentOn > todayISO()) errors.spent_on = "Date can't be in the future.";
  if (!(method in PAYMENT_METHODS)) errors.method = "Pick how it was paid.";
  if (billId && !UUID_RE.test(billId)) errors.category = "Invalid bill.";
  if (trainerId && !UUID_RE.test(trainerId)) errors.category = "Invalid trainer.";
  if (billMonth && !/^\d{4}-\d{2}-01$/.test(billMonth)) errors.category = "Invalid month.";

  if (Object.keys(errors).length > 0) return { errors } as const;
  return {
    row: {
      category,
      description: description || null,
      amount: amount as number,
      spent_on: spentOn,
      method,
      recurring_bill_id: billId || null,
      trainer_id: trainerId || null,
      bill_month: billId || trainerId ? billMonth || null : null,
    },
  } as const;
}

function dbError(error: { code?: string; message: string }, action: string): ExpenseFormState {
  // 23505: unique index "one payment per bill/salary per month".
  if (error.code === "23505") {
    return { status: "error", message: "This bill is already marked as paid for that month. Edit the existing expense instead." };
  }
  console.error(`${action} failed:`, error);
  return { status: "error", message: "Could not save the expense. Please try again." };
}

function done(month: string, flag: string): never {
  revalidatePath("/", "layout"); // expenses list, checklist, money dashboard
  redirect(`/expenses?month=${month.slice(0, 7)}&${flag}=1`);
}

export async function createExpense(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const parsed = parseExpenseForm(formData);
  if ("errors" in parsed) return invalid(parsed.errors);

  const { error } = await getSupabase().from("expenses").insert(parsed.row);
  if (error) return dbError(error, "createExpense");
  done(parsed.row.spent_on, "saved");
}

export async function updateExpense(id: string, _prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  if (!UUID_RE.test(id)) return { status: "error", message: "Invalid expense." };
  const parsed = parseExpenseForm(formData);
  if ("errors" in parsed) return invalid(parsed.errors);

  const { data, error } = await getSupabase().from("expenses").update(parsed.row).eq("id", id).select("id");
  if (error) return dbError(error, "updateExpense");
  if (!data?.length) return { status: "error", message: "This expense no longer exists." };
  done(parsed.row.spent_on, "saved");
}

export async function deleteExpense(id: string, month: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(id)) return { error: "Invalid expense." };

  const { error } = await getSupabase().from("expenses").delete().eq("id", id);
  if (error) {
    console.error("deleteExpense failed:", error);
    return { error: "Could not delete the expense. Please try again." };
  }
  done(month, "deleted");
}

// ---------------------------------------------------------------------------
// Recurring bills
// ---------------------------------------------------------------------------

function parseBillForm(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const errors: Record<string, string> = {};

  const name = get("name");
  const category = get("category");
  const amount = parseMoney(get("amount"));
  const dueDay = Number(get("due_day"));
  const isActive = formData.get("is_active") === "on";

  if (!name) errors.name = "Name is required.";
  else if (name.length > 60) errors.name = "Keep it under 60 characters.";
  if (!(category in EXPENSE_CATEGORIES)) errors.category = "Pick a category.";
  if (Number.isNaN(amount)) errors.amount = "Enter a valid amount, or leave empty if it varies.";
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) errors.due_day = "Pick a day from 1 to 28.";

  if (Object.keys(errors).length > 0) return { errors } as const;
  return { row: { name, category, amount: amount ?? 0, due_day: dueDay, is_active: isActive } } as const;
}

function billsDone(flag: string): never {
  revalidatePath("/", "layout");
  redirect(`/expenses/bills?${flag}=1`);
}

export async function createBill(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const parsed = parseBillForm(formData);
  if ("errors" in parsed) return invalid(parsed.errors);

  const { error } = await getSupabase().from("recurring_bills").insert(parsed.row);
  if (error) {
    console.error("createBill failed:", error);
    return { status: "error", message: "Could not save the bill. Please try again." };
  }
  billsDone("saved");
}

export async function updateBill(id: string, _prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  if (!UUID_RE.test(id)) return { status: "error", message: "Invalid bill." };
  const parsed = parseBillForm(formData);
  if ("errors" in parsed) return invalid(parsed.errors);

  const { data, error } = await getSupabase().from("recurring_bills").update(parsed.row).eq("id", id).select("id");
  if (error) {
    console.error("updateBill failed:", error);
    return { status: "error", message: "Could not save the bill. Please try again." };
  }
  if (!data?.length) return { status: "error", message: "This bill no longer exists." };
  billsDone("saved");
}

/** Past expenses that paid this bill are kept (FK is ON DELETE SET NULL). */
export async function deleteBill(id: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(id)) return { error: "Invalid bill." };

  const { error } = await getSupabase().from("recurring_bills").delete().eq("id", id);
  if (error) {
    console.error("deleteBill failed:", error);
    return { error: "Could not delete the bill. Please try again." };
  }
  billsDone("deleted");
}
