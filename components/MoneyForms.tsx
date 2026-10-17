"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { MoneyFormState } from "@/app/clients/[id]/money-actions";
import { FormMessage, primaryBtn, secondaryBtn } from "@/components/form";
import { MembershipFields } from "@/components/MembershipFields";
import { PaymentFields } from "@/components/PaymentFields";
import type { Membership, PackageOption } from "@/lib/types";

const INITIAL: MoneyFormState = { status: "idle" };
type Action = (prev: MoneyFormState, formData: FormData) => Promise<MoneyFormState>;

function Actions({ clientId, pending, label }: { clientId: string; pending: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Link href={`/clients/${clientId}`} className={secondaryBtn}>
        Cancel
      </Link>
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}

/** New membership period + optional payment. */
export function RenewForm(props: {
  action: Action;
  clientId: string;
  packages: PackageOption[];
  receivers: string[];
  today: string;
  defaultStart: string;
  defaultPackageId: string | null;
}) {
  const [state, formAction, pending] = useActionState(props.action, INITIAL);
  const [amount, setAmount] = useState(() => String(props.packages.find((p) => p.id === props.defaultPackageId)?.price ?? ""));
  const [amountTouched, setAmountTouched] = useState(false);

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <FormMessage status={state.status} message={state.message} />
      <MembershipFields
        packages={props.packages}
        errors={state.fieldErrors}
        startName="start_date"
        startLabel="Starts on"
        defaultStart={props.defaultStart}
        defaultPackageId={props.defaultPackageId}
        onFeeChange={(fee) => {
          if (!amountTouched) setAmount(fee);
        }}
      />
      <PaymentFields
        title="Paid now"
        optional
        showNote
        receivers={props.receivers}
        today={props.today}
        errors={state.fieldErrors}
        amount={amount}
        onAmountChange={(v) => {
          setAmount(v);
          setAmountTouched(true);
        }}
      />
      <Actions clientId={props.clientId} pending={pending} label="Renew membership" />
    </form>
  );
}

/** A payment on its own, e.g. the balance of a part payment. */
export function PaymentForm(props: { action: Action; clientId: string; receivers: string[]; today: string; suggested: number }) {
  const [state, formAction, pending] = useActionState(props.action, INITIAL);
  const [amount, setAmount] = useState(props.suggested > 0 ? String(props.suggested) : "");

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <FormMessage status={state.status} message={state.message} />
      <PaymentFields
        showNote
        receivers={props.receivers}
        today={props.today}
        errors={state.fieldErrors}
        amount={amount}
        onAmountChange={setAmount}
      />
      <Actions clientId={props.clientId} pending={pending} label="Save payment" />
    </form>
  );
}

/** Correct an existing membership period. */
export function MembershipEditForm(props: { action: Action; clientId: string; packages: PackageOption[]; membership: Membership }) {
  const [state, formAction, pending] = useActionState(props.action, INITIAL);
  const m = props.membership;

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <FormMessage status={state.status} message={state.message} />
      <MembershipFields
        packages={props.packages}
        errors={state.fieldErrors}
        startName="start_date"
        startLabel="Starts on"
        defaultStart={m.start_date}
        initial={m}
      />
      <Actions clientId={props.clientId} pending={pending} label="Save changes" />
    </form>
  );
}
