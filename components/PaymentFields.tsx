"use client";

import { Field, inputCls } from "@/components/form";
import { OWNER_LABEL, PAYMENT_METHODS } from "@/lib/types";

type Props = {
  receivers: string[];
  today: string;
  errors?: Partial<Record<string, string>>;
  /** Controlled amount so a parent can pre-fill it (e.g. with the package fee). */
  amount: string;
  onAmountChange: (v: string) => void;
  title?: string;
  /** Explains that leaving the amount empty records no payment. */
  optional?: boolean;
  showNote?: boolean;
};

/** Amount, date, method (Cash/UPI/...) and who took the money. */
export function PaymentFields({ receivers, today, errors = {}, amount, onAmountChange, title = "Payment", optional, showNote }: Props) {
  return (
    <fieldset className="space-y-5 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-medium text-slate-700">{title}</legend>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Amount received" error={errors.amount} hint={optional ? "Leave empty if they haven't paid yet." : undefined}>
          <input
            name="amount"
            inputMode="decimal"
            required={!optional}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="1500"
            className={inputCls}
            aria-invalid={!!errors.amount}
          />
        </Field>
        <Field label="Date received" error={errors.paid_on}>
          <input name="paid_on" type="date" required max={today} defaultValue={today} className={inputCls} aria-invalid={!!errors.paid_on} />
        </Field>
        <Field label="Paid by" error={errors.method}>
          <select name="method" defaultValue="cash" className={inputCls} aria-invalid={!!errors.method}>
            {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Received by" error={errors.received_by}>
          <select name="received_by" defaultValue={OWNER_LABEL} className={inputCls} aria-invalid={!!errors.received_by}>
            {receivers.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {showNote && (
        <Field label="Note (optional)" error={errors.note}>
          <input name="note" maxLength={200} placeholder="e.g. part payment, balance next week" className={inputCls} />
        </Field>
      )}
    </fieldset>
  );
}
