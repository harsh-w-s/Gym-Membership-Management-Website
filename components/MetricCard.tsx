type Props = {
  label: string;
  value: number;
  hint?: string;
  tone?: "slate" | "emerald" | "amber";
};

const DOT = {
  slate: "bg-slate-400",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
};

export function MetricCard({ label, value, hint, tone = "slate" }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${DOT[tone]}`} aria-hidden />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
