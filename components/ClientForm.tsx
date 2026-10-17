"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ClientFormState } from "@/app/clients/actions";
import { Field, FormMessage, inputCls, primaryBtn, secondaryBtn } from "@/components/form";
import { formatMoney, parseMoney } from "@/lib/money";
import { isValidIntlPhone, sanitizePhone } from "@/lib/phone";
import { BLOOD_GROUPS, type Client, type TrainerOption } from "@/lib/types";

const INITIAL: ClientFormState = { status: "idle" };

type Props = {
  trainers: TrainerOption[];
  action: (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  /** Present when editing an existing client. */
  client?: Client;
};

export function ClientForm({ trainers, action, client }: Props) {
  const isEdit = !!client;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [phone, setPhone] = useState(client ? `+${client.phone}` : "");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [fee, setFee] = useState(client ? String(client.package_fee) : "");
  const [paid, setPaid] = useState(client ? String(client.amount_paid) : "");
  const formRef = useRef<HTMLFormElement>(null);

  // After a successful "add", clear the form so the next member can be entered.
  // (A successful edit redirects to the client's page instead.)
  useEffect(() => {
    if (state.status === "success" && !isEdit) {
      formRef.current?.reset();
      setPhone("");
      setFee("");
      setPaid("");
      setPhoneTouched(false);
    }
  }, [state, isEdit]);

  const phoneDigits = sanitizePhone(phone);
  const phoneError =
    (phoneTouched && phone && !isValidIntlPhone(phoneDigits) ? "Enter 8–15 digits including country code." : undefined) ??
    state.fieldErrors?.phone;

  const feeNum = parseMoney(fee) ?? 0;
  const paidNum = parseMoney(paid) ?? 0;
  const balance = Number.isNaN(feeNum) || Number.isNaN(paidNum) ? null : feeNum - paidNum;

  const err = (f: keyof NonNullable<ClientFormState["fieldErrors"]>) => state.fieldErrors?.[f];

  return (
    <form ref={formRef} action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <FormMessage status={state.status} message={state.message} />

      <Field label="Full name" error={err("name")}>
        <input
          name="name"
          required
          maxLength={100}
          autoComplete="off"
          defaultValue={client?.name}
          placeholder="Aarav Sharma"
          className={inputCls}
          aria-invalid={!!err("name")}
        />
      </Field>

      <Field
        label="WhatsApp phone number"
        error={phoneError}
        hint={phoneDigits ? `Will be saved as: ${phoneDigits}  →  wa.me/${phoneDigits}` : "Include the country code, e.g. +91 98765 43210"}
      >
        {/*
          Sanitisation: whatever is typed ("+91 98765-43210", "(0091) 98765 43210"),
          the submitted value is digits only. The visible input keeps what was typed
          for readability; the hidden input carries the clean value.
        */}
        <input
          type="tel"
          inputMode="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setPhoneTouched(true)}
          placeholder="+91 98765 43210"
          className={inputCls}
          aria-invalid={!!phoneError}
        />
        <input type="hidden" name="phone" value={phoneDigits} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Age" error={err("age")}>
          <input
            name="age"
            type="number"
            min={5}
            max={120}
            step={1}
            defaultValue={client?.age ?? undefined}
            placeholder="28"
            className={inputCls}
            aria-invalid={!!err("age")}
          />
        </Field>
        <Field label="Blood group" error={err("blood_group")}>
          <select name="blood_group" defaultValue={client?.blood_group ?? ""} className={inputCls} aria-invalid={!!err("blood_group")}>
            <option value="">Not specified</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Package name" error={err("package_name")}>
          <input
            name="package_name"
            required
            maxLength={60}
            list="package-suggestions"
            defaultValue={client?.package_name}
            placeholder="Quarterly"
            className={inputCls}
            aria-invalid={!!err("package_name")}
          />
          <datalist id="package-suggestions">
            <option value="Monthly" />
            <option value="Quarterly" />
            <option value="Half-Yearly" />
            <option value="Annual" />
            <option value="Personal Training – Monthly" />
          </datalist>
        </Field>
        <Field label="Expiry date" error={err("expiry_date")}>
          <input
            name="expiry_date"
            type="date"
            required
            defaultValue={client?.expiry_date}
            className={inputCls}
            aria-invalid={!!err("expiry_date")}
          />
        </Field>
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Payment</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Package fee" error={err("package_fee")}>
            <input
              name="package_fee"
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="4500"
              className={inputCls}
              aria-invalid={!!err("package_fee")}
            />
          </Field>
          <Field label="Amount paid" error={err("amount_paid")}>
            <input
              name="amount_paid"
              inputMode="decimal"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="4500"
              className={inputCls}
              aria-invalid={!!err("amount_paid")}
            />
          </Field>
        </div>
        {balance !== null && (fee || paid) && (
          <p className={`mt-3 text-sm font-medium ${balance > 0 ? "text-red-600" : "text-emerald-700"}`}>
            {balance > 0
              ? `Balance due: ${formatMoney(balance)}`
              : balance < 0
                ? `Paid in advance: ${formatMoney(-balance)}`
                : "Fully paid ✓"}
          </p>
        )}
      </fieldset>

      <Field label="Trainer" error={err("trainer_id")}>
        <select name="trainer_id" defaultValue={client?.trainer_id ?? ""} className={inputCls} aria-invalid={!!err("trainer_id")}>
          <option value="">No trainer assigned</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.speciality ? ` — ${t.speciality}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        {isEdit && (
          <Link href={`/clients/${client.id}`} className={secondaryBtn}>
            Cancel
          </Link>
        )}
        <button type="submit" disabled={pending || (phone !== "" && !isValidIntlPhone(phoneDigits))} className={primaryBtn}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Add Client"}
        </button>
      </div>
    </form>
  );
}
