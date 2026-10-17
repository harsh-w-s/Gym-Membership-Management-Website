import type { Metadata } from "next";
import Link from "next/link";
import { inputCls, primaryBtn, secondaryBtn } from "@/components/form";
import { MetricCard } from "@/components/MetricCard";
import { formatMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import type { Trainer } from "@/lib/types";

export const metadata: Metadata = { title: "Trainers" };
export const dynamic = "force-dynamic";

// `clients(count)` makes PostgREST return the number of clients linked to each
// trainer via the trainer_id foreign key, e.g. clients: [{ count: 12 }].
type Row = Trainer & { clients: { count: number }[] };

export default async function TrainersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  let query = getSupabase().from("trainers").select("*, clients(count)").order("name");
  if (q) {
    // Strip PostgREST filter syntax characters before building the OR filter.
    const text = q.replace(/[^\p{L}\p{N}\s'&-]/gu, "").trim();
    if (text) query = query.or(`name.ilike.*${text}*,speciality.ilike.*${text}*`);
  }

  const { data, error } = await query.overrideTypes<Row[], { merge: false }>();
  if (error) throw new Error(`Failed to load trainers: ${error.message}`);

  const trainers = data ?? [];
  const totalSalary = trainers.reduce((sum, t) => sum + t.salary, 0);
  const totalClients = trainers.reduce((sum, t) => sum + (t.clients[0]?.count ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trainers</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your training staff and their salaries.</p>
        </div>
        <Link href="/trainers/new" className={primaryBtn}>
          + Add Trainer
        </Link>
      </header>

      {(sp.saved === "1" || sp.deleted === "1") && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.deleted === "1" ? "Trainer deleted. Their clients are now unassigned." : "Trainer saved."}
        </div>
      )}

      {!q && (
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Summary">
          <MetricCard label="Trainers" value={trainers.length} />
          <MetricCard label="Assigned clients" value={totalClients} tone="emerald" />
          <MetricCard label="Monthly salaries" value={formatMoney(totalSalary)} tone="amber" />
        </section>
      )}

      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} placeholder="Search by name or speciality" className={`${inputCls} mt-0 sm:max-w-sm`} />
        <button type="submit" className={primaryBtn}>
          Search
        </button>
        {q && (
          <Link href="/trainers" className={secondaryBtn}>
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {trainers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            {q ? "No trainers match your search." : "No trainers yet. Add your first one!"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Trainer</th>
                  <th className="px-4 py-3">Speciality</th>
                  <th className="px-4 py-3 text-right">Clients</th>
                  <th className="px-4 py-3 text-right">Salary / month</th>
                  <th className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trainers.map((t) => {
                  const clientCount = t.clients[0]?.count ?? 0;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{t.name}</div>
                        <div className="text-xs text-slate-500">{t.phone ? `+${t.phone}` : "No phone"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t.speciality ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {clientCount > 0 ? (
                          <Link href={`/clients?trainer=${t.id}`} className="text-emerald-700 hover:underline">
                            {clientCount}
                          </Link>
                        ) : (
                          0
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMoney(t.salary)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/trainers/${t.id}/edit`} className="font-medium text-emerald-700 hover:text-emerald-800">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
