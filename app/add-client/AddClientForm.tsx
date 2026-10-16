"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { isValidIntlPhone, sanitizePhone } from "@/lib/phone";
import { BLOOD_GROUPS, type Trainer } from "@/lib/types";
import { createClient, type FormState } from "./actions";

const INITIAL: FormState = { status: "idle" };

const inputCls =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 aria-[invalid=true]:border-red-400";

export function AddClientForm({ trainers }: { trainers: Pick<Trainer, "id" | "name" | "speciality">[] }) {
  const [state, formAction, pending] = useActionState(createClient, INITIAL);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form after a successful insert so the owner can add the next member.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setPhone("");
      setPhoneTouched(false);
    }
  }, [state]);

  const phoneDigits = sanitizePhone(phone);
  const phoneError =
    (phoneTouched && phone && !isValidIntlPhone(phoneDigits) ? "Enter 8–15 digits including country code." : undefined) ??
    state.fieldErrors?.phone;

  const err = (f: keyof NonNullable<FormState["fieldErrors"]>) => state.fieldErrors?.[f];

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {state.message && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            state.status === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      )}

      <Field label="Full name" error={err("name")}>
        <input name="name" required maxLength={100} autoComplete="off" placeholder="Aarav Sharma" className={inputCls} aria-invalid={!!err("name")} />
      </Field>

      <Field
        label="WhatsApp phone number"
        error={phoneError}
        hint={phoneDigits ? `Will be saved as: ${phoneDigits}  →  wa.me/${phoneDigits}` : "Include the country code, e.g. +91 98765 43210"}
      >
        {/*
          Sanitisation: whatever the owner types ("+91 98765-43210", "(0091) 98765 43210"),
          the submitted value is digits only. The visible input keeps what they typed for
          readability; the hidden input carries the clean value that the server receives.
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
          <input name="age" type="number" min={5} max={120} step={1} placeholder="28" className={inputCls} aria-invalid={!!err("age")} />
        </Field>
        <Field label="Blood group" error={err("blood_group")}>
          <select name="blood_group" defaultValue="" className={inputCls} aria-invalid={!!err("blood_group")}>
            <option value="">Not specified</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Package name" error={err("package_name")}>
          <input name="package_name" required maxLength={60} list="package-suggestions" placeholder="3 Months – Strength" className={inputCls} aria-invalid={!!err("package_name")} />
          <datalist id="package-suggestions">
            <option value="Monthly" />
            <option value="Quarterly" />
            <option value="Half-Yearly" />
            <option value="Annual" />
            <option value="Personal Training – Monthly" />
          </datalist>
        </Field>
        <Field label="Expiry date" error={err("expiry_date")}>
          <input name="expiry_date" type="date" required className={inputCls} aria-invalid={!!err("expiry_date")} />
        </Field>
      </div>

      <Field label="Trainer" error={err("trainer_id")}>
        <select name="trainer_id" defaultValue="" className={inputCls} aria-invalid={!!err("trainer_id")}>
          <option value="">No trainer assigned</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.speciality ? ` — ${t.speciality}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending || (phone !== "" && !isValidIntlPhone(phoneDigits))}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add Client"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block font-mono text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}
