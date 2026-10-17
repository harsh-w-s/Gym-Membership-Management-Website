"use client";

import { useState } from "react";
import { Field, inputCls } from "@/components/form";
import { membershipEndDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { PackageOption } from "@/lib/types";

const CUSTOM = "__custom__";

type Props = {
  packages: PackageOption[];
  errors?: Partial<Record<string, string>>;
  /** Form field name for the start date ("joined_on" on Add Client, "start_date" on Renew). */
  startName: string;
  startLabel: string;
  defaultStart: string;
  /** Latest allowed start date (e.g. today for a joining date). */
  maxStart?: string;
  /** Existing values when editing a membership. */
  initial?: { package_id: string | null; package_name: string; end_date: string; fee: number };
  /** Renew: package to preselect (ignored when `initial` is given). */
  defaultPackageId?: string | null;
  /** Lets the parent pre-fill "amount paid" with the fee. */
  onFeeChange?: (fee: string) => void;
};

/**
 * Package picker + start/expiry dates + fee. Picking a package fills the fee
 * and works out the expiry date from the start date; both stay editable.
 */
export function MembershipFields({
  packages,
  errors = {},
  startName,
  startLabel,
  defaultStart,
  maxStart,
  initial,
  defaultPackageId,
  onFeeChange,
}: Props) {
  // Renew: preselect the client's current package and work out fee + expiry.
  const preset = !initial ? packages.find((p) => p.id === defaultPackageId) : undefined;
  const initialChoice = initial
    ? initial.package_id && packages.some((p) => p.id === initial.package_id)
      ? initial.package_id
      : CUSTOM
    : (preset?.id ?? "");
  const [choice, setChoice] = useState(initialChoice);
  const [customName, setCustomName] = useState(initialChoice === CUSTOM ? (initial?.package_name ?? "") : "");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(
    initial?.end_date ?? (preset && defaultStart ? membershipEndDate(defaultStart, preset.duration_months) : ""),
  );
  const [fee, setFee] = useState(initial ? String(initial.fee) : preset ? String(preset.price) : "");

  const pkg = packages.find((p) => p.id === choice);
  const packageName = pkg ? pkg.name : customName;

  const updateFee = (v: string) => {
    setFee(v);
    onFeeChange?.(v);
  };

  // Recompute expiry whenever the package or start date changes (if a package is picked).
  const recompute = (nextChoice: string, nextStart: string) => {
    const p = packages.find((x) => x.id === nextChoice);
    if (p && nextStart) setEnd(membershipEndDate(nextStart, p.duration_months));
  };

  return (
    <fieldset className="space-y-5 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-medium text-slate-700">Membership</legend>

      <input type="hidden" name="package_id" value={pkg?.id ?? ""} />
      <input type="hidden" name="package_name" value={packageName} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Package" error={errors.package_name}>
          <select
            value={choice}
            onChange={(e) => {
              const next = e.target.value;
              setChoice(next);
              const p = packages.find((x) => x.id === next);
              if (p) updateFee(String(p.price));
              recompute(next, start);
            }}
            className={inputCls}
            aria-invalid={!!errors.package_name}
            required
          >
            <option value="" disabled>
              Choose a package…
            </option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.duration_months} mo · {formatMoney(p.price)}
              </option>
            ))}
            <option value={CUSTOM}>Custom…</option>
          </select>
        </Field>
        {choice === CUSTOM ? (
          <Field label="Custom package name" error={errors.package_name}>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              maxLength={60}
              required
              placeholder="e.g. 15-day trial"
              className={inputCls}
            />
          </Field>
        ) : (
          <Field label="Fee" error={errors.fee}>
            <input name="fee" inputMode="decimal" value={fee} onChange={(e) => updateFee(e.target.value)} placeholder="4500" className={inputCls} />
          </Field>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label={startLabel} error={errors[startName]}>
          <input
            name={startName}
            type="date"
            required
            max={maxStart}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              recompute(choice, e.target.value);
            }}
            className={inputCls}
            aria-invalid={!!errors[startName]}
          />
        </Field>
        <Field label="Expiry date" error={errors.end_date} hint={pkg ? "Worked out from the package. You can change it." : undefined}>
          <input
            name="end_date"
            type="date"
            required
            min={start || undefined}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputCls}
            aria-invalid={!!errors.end_date}
          />
        </Field>
        {choice === CUSTOM && (
          <Field label="Fee" error={errors.fee}>
            <input name="fee" inputMode="decimal" value={fee} onChange={(e) => updateFee(e.target.value)} placeholder="1000" className={inputCls} />
          </Field>
        )}
      </div>
    </fieldset>
  );
}
