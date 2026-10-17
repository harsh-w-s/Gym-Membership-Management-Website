"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { TrainerFormState } from "@/app/trainers/actions";
import { Field, FormMessage, inputCls, primaryBtn, secondaryBtn } from "@/components/form";
import { isValidIntlPhone, sanitizePhone } from "@/lib/phone";
import type { Trainer } from "@/lib/types";

const INITIAL: TrainerFormState = { status: "idle" };

type Props = {
  action: (prev: TrainerFormState, formData: FormData) => Promise<TrainerFormState>;
  /** Present when editing an existing trainer. */
  trainer?: Trainer;
};

export function TrainerForm({ action, trainer }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [phone, setPhone] = useState(trainer?.phone ? `+${trainer.phone}` : "");

  const phoneDigits = sanitizePhone(phone);
  const phoneError =
    (phoneDigits && !isValidIntlPhone(phoneDigits) ? "Enter 8–15 digits including country code." : undefined) ??
    state.fieldErrors?.phone;
  const err = (f: keyof NonNullable<TrainerFormState["fieldErrors"]>) => state.fieldErrors?.[f];

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <FormMessage status={state.status} message={state.message} />

      <Field label="Full name" error={err("name")}>
        <input
          name="name"
          required
          maxLength={100}
          autoComplete="off"
          defaultValue={trainer?.name}
          placeholder="Rahul Verma"
          className={inputCls}
          aria-invalid={!!err("name")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone number (optional)" error={phoneError} hint="Include the country code, e.g. +91 98765 43210">
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className={inputCls}
            aria-invalid={!!phoneError}
          />
          <input type="hidden" name="phone" value={phoneDigits} />
        </Field>
        <Field label="Speciality" error={err("speciality")}>
          <input
            name="speciality"
            maxLength={80}
            list="speciality-suggestions"
            defaultValue={trainer?.speciality ?? undefined}
            placeholder="Strength & Conditioning"
            className={inputCls}
            aria-invalid={!!err("speciality")}
          />
          <datalist id="speciality-suggestions">
            <option value="Strength & Conditioning" />
            <option value="Weight Loss" />
            <option value="Yoga & Mobility" />
            <option value="CrossFit" />
            <option value="Cardio & Zumba" />
          </datalist>
        </Field>
      </div>

      <Field label="Monthly salary" error={err("salary")}>
        <input
          name="salary"
          inputMode="decimal"
          defaultValue={trainer ? String(trainer.salary) : undefined}
          placeholder="25000"
          className={inputCls}
          aria-invalid={!!err("salary")}
        />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Link href="/trainers" className={secondaryBtn}>
          Cancel
        </Link>
        <button type="submit" disabled={pending || !!(phoneDigits && !isValidIntlPhone(phoneDigits))} className={primaryBtn}>
          {pending ? "Saving…" : trainer ? "Save changes" : "Add Trainer"}
        </button>
      </div>
    </form>
  );
}
