"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { PackageFormState } from "@/app/settings/packages/actions";
import { Field, FormMessage, inputCls, primaryBtn, secondaryBtn } from "@/components/form";
import type { Package } from "@/lib/types";

const INITIAL: PackageFormState = { status: "idle" };
const DURATIONS = [1, 2, 3, 6, 9, 12, 24];

type Props = {
  action: (prev: PackageFormState, formData: FormData) => Promise<PackageFormState>;
  pkg?: Package;
};

export function PackageForm({ action, pkg }: Props) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const err = (f: keyof NonNullable<PackageFormState["fieldErrors"]>) => state.fieldErrors?.[f];

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <FormMessage status={state.status} message={state.message} />

      <Field label="Package name" error={err("name")}>
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={pkg?.name}
          placeholder="Quarterly"
          className={inputCls}
          aria-invalid={!!err("name")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Duration" error={err("duration_months")}>
          <select name="duration_months" defaultValue={pkg?.duration_months ?? 1} className={inputCls} aria-invalid={!!err("duration_months")}>
            {[...new Set([...DURATIONS, pkg?.duration_months ?? 1])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {m} month{m === 1 ? "" : "s"}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Price" error={err("price")} hint="Total price for the whole duration.">
          <input
            name="price"
            inputMode="decimal"
            required
            defaultValue={pkg ? String(pkg.price) : undefined}
            placeholder="4500"
            className={inputCls}
            aria-invalid={!!err("price")}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={pkg?.is_active ?? true}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>
          <span className="font-medium text-slate-700">Available for new sign-ups</span>
          <span className="block text-xs text-slate-500">Untick to hide an old package without deleting it.</span>
        </span>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Link href="/settings/packages" className={secondaryBtn}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : pkg ? "Save changes" : "Add Package"}
        </button>
      </div>
    </form>
  );
}
