"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { ClientFormState } from "@/app/clients/actions";
import { Field, FormMessage, inputCls, primaryBtn, secondaryBtn } from "@/components/form";
import { MembershipFields } from "@/components/MembershipFields";
import { PaymentFields } from "@/components/PaymentFields";
import { isValidIntlPhone, sanitizePhone } from "@/lib/phone";
import { BLOOD_GROUPS, type Client, type PackageOption, type TrainerOption } from "@/lib/types";

const INITIAL: ClientFormState = { status: "idle" };

type Props = {
  trainers: TrainerOption[];
  action: (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  /** Today's date (YYYY-MM-DD) in the gym's timezone, computed on the server. */
  today: string;
  /** Present when editing an existing client (personal details only). */
  client?: Client;
  /** Add mode only: package picker + "paid now". */
  packages?: PackageOption[];
  receivers?: string[];
};

export function ClientForm(props: Props) {
  const [state, formAction, pending] = useActionState(props.action, INITIAL);
  // After a successful "add", remount the form with fresh defaults so the next
  // member can be entered. (A successful edit redirects instead.)
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state.status === "success" && !props.client) setFormKey((k) => k + 1);
  }, [state, props.client]);

  return (
    <div className="space-y-4">
      <FormMessage status={state.status} message={state.message} />
      <ClientFormFields key={formKey} {...props} state={state} formAction={formAction} pending={pending} />
    </div>
  );
}

function ClientFormFields({
  trainers,
  today,
  client,
  packages = [],
  receivers = [],
  state,
  formAction,
  pending,
}: Props & { state: ClientFormState; formAction: (fd: FormData) => void; pending: boolean }) {
  const isEdit = !!client;
  const [phone, setPhone] = useState(client ? `+${client.phone}` : "");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);

  const phoneDigits = sanitizePhone(phone);
  const phoneError =
    (phoneTouched && phone && !isValidIntlPhone(phoneDigits) ? "Enter 8–15 digits including country code." : undefined) ??
    state.fieldErrors?.phone;
  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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

      <div className="grid gap-5 sm:grid-cols-3">
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
        <Field label="Trainer" error={err("trainer_id")}>
          <select name="trainer_id" defaultValue={client?.trainer_id ?? ""} className={inputCls} aria-invalid={!!err("trainer_id")}>
            <option value="">No trainer</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {isEdit ? (
        <>
          <Field label="Joining date" error={err("joined_on")}>
            <input
              name="joined_on"
              type="date"
              required
              max={today}
              defaultValue={client.joined_on}
              className={`${inputCls} sm:max-w-xs`}
              aria-invalid={!!err("joined_on")}
            />
          </Field>
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            To change the package, expiry or payments, use <strong>Renew</strong>, <strong>Record payment</strong> or edit a
            membership on the client&apos;s page. That way the payment history stays correct.
          </p>
        </>
      ) : (
        <>
          <MembershipFields
            packages={packages}
            errors={state.fieldErrors}
            startName="joined_on"
            startLabel="Joining date"
            defaultStart={today}
            maxStart={today}
            onFeeChange={(fee) => {
              // Pre-fill "amount received" with the fee until the user types their own.
              if (!amountTouched) setAmount(fee);
            }}
          />
          <PaymentFields
            title="Paid now"
            optional
            receivers={receivers}
            today={today}
            errors={state.fieldErrors}
            amount={amount}
            onAmountChange={(v) => {
              setAmount(v);
              setAmountTouched(true);
            }}
          />
        </>
      )}

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
