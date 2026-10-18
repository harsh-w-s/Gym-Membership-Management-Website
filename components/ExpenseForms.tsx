"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ExpenseFormState } from "@/app/expenses/actions";
import { Field, FormMessage, inputCls, primaryBtn, secondaryBtn } from "@/components/form";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type Expense, type ExpenseCategory, type RecurringBill } from "@/lib/types";

const INITIAL: ExpenseFormState = { status: "idle" };
type Action = (prev: ExpenseFormState, formData: FormData) => Promise<ExpenseFormState>;

function CategorySelect({ value, error }: { value?: ExpenseCategory; error?: string }) {
  return (
    <select name="category" defaultValue={value ?? ""} required className={inputCls} aria-invalid={!!error}>
      <option value="" disabled>
        Choose…
      </option>
      {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

export type ExpensePreset = {
  category: ExpenseCategory;
  description: string;
  amount: number;
  recurring_bill_id?: string;
  trainer_id?: string;
  bill_month: string;
};

/**
 * Add/edit an expense. `preset` comes from the bills checklist ("Mark paid"):
 * it pre-fills the form and links the expense to that bill + month.
 */
export function ExpenseForm({
  action,
  today,
  expense,
  preset,
  cancelHref,
}: {
  action: Action;
  today: string;
  expense?: Expense;
  preset?: ExpensePreset;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const err = (f: string) => state.fieldErrors?.[f];
  const link = expense
    ? { recurring_bill_id: expense.recurring_bill_id, trainer_id: expense.trainer_id, bill_month: expense.bill_month }
    : preset
      ? { recurring_bill_id: preset.recurring_bill_id ?? null, trainer_id: preset.trainer_id ?? null, bill_month: preset.bill_month }
      : null;

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <FormMessage status={state.status} message={state.message} />

      {link && (
        <>
          <input type="hidden" name="recurring_bill_id" value={link.recurring_bill_id ?? ""} />
          <input type="hidden" name="trainer_id" value={link.trainer_id ?? ""} />
          <input type="hidden" name="bill_month" value={link.bill_month ?? ""} />
        </>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Category" error={err("category")}>
          <CategorySelect value={expense?.category ?? preset?.category} error={err("category")} />
        </Field>
        <Field label="Amount" error={err("amount")}>
          <input
            name="amount"
            inputMode="decimal"
            required
            defaultValue={expense ? String(expense.amount) : preset?.amount ? String(preset.amount) : undefined}
            placeholder="4200"
            className={inputCls}
            aria-invalid={!!err("amount")}
          />
        </Field>
      </div>

      <Field label="Description (optional)" error={err("description")}>
        <input
          name="description"
          maxLength={200}
          defaultValue={expense?.description ?? preset?.description}
          placeholder="e.g. October electricity bill, treadmill belt repair"
          className={inputCls}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Date paid" error={err("spent_on")}>
          <input
            name="spent_on"
            type="date"
            required
            max={today}
            defaultValue={expense?.spent_on ?? today}
            className={inputCls}
            aria-invalid={!!err("spent_on")}
          />
        </Field>
        <Field label="Paid by" error={err("method")}>
          <select name="method" defaultValue={expense?.method ?? "cash"} className={inputCls}>
            {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Link href={cancelHref} className={secondaryBtn}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : expense ? "Save changes" : "Save expense"}
        </button>
      </div>
    </form>
  );
}

/** Add/edit a recurring monthly bill. */
export function BillForm({ action, bill }: { action: Action; bill?: RecurringBill }) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <FormMessage status={state.status} message={state.message} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Bill name" error={err("name")}>
          <input name="name" required maxLength={60} defaultValue={bill?.name} placeholder="Rent" className={inputCls} aria-invalid={!!err("name")} />
        </Field>
        <Field label="Category" error={err("category")}>
          <CategorySelect value={bill?.category} error={err("category")} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Usual amount" error={err("amount")} hint="Leave empty if it changes every month (e.g. electricity).">
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={bill && bill.amount > 0 ? String(bill.amount) : undefined}
            placeholder="30000"
            className={inputCls}
            aria-invalid={!!err("amount")}
          />
        </Field>
        <Field label="Due on day" error={err("due_day")}>
          <select name="due_day" defaultValue={bill?.due_day ?? 1} className={inputCls}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={bill?.is_active ?? true}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="font-medium text-slate-700">Show in the monthly checklist</span>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Link href="/expenses/bills" className={secondaryBtn}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : bill ? "Save changes" : "Add bill"}
        </button>
      </div>
    </form>
  );
}
