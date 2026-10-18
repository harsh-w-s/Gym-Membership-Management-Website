import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { WhatsAppRemindButton } from "@/components/WhatsAppRemindButton";
import { addDaysISO, formatDate, monthEndISO, monthStartISO, todayISO } from "@/lib/dates";
import { getBreakdown } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import { buildReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

// Always render on request: "today" and membership data change daily.
export const dynamic = "force-dynamic";

type ExpiringRow = {
  id: string;
  name: string;
  phone: string;
  package_name: string;
  expiry_date: string;
  // PostgREST embeds the FK target as an object (null when trainer_id is null).
  trainers: { name: string } | null;
};

async function getDashboardData(today: string) {
  const supabase = getSupabase();
  const weekAhead = addDaysISO(today, 7);

  // All four queries run in parallel. `{ count: "exact", head: true }` asks
  // PostgREST for only the row count (via Content-Range), no rows returned.
  const [total, active, upcoming, expiring] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    // Active = membership still valid after today.
    supabase.from("clients").select("id", { count: "exact", head: true }).gt("expiry_date", today),
    // Heads-up count: still active but lapsing within the next 7 days.
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .gt("expiry_date", today)
      .lte("expiry_date", weekAhead),
    // Action list: expiry_date <= today, oldest lapse first.
    // `trainers(name)` follows the trainer_id foreign key and embeds the trainer's name.
    supabase
      .from("clients")
      .select("id, name, phone, package_name, expiry_date, trainers(name)")
      .lte("expiry_date", today)
      .order("expiry_date", { ascending: true })
      .overrideTypes<ExpiringRow[], { merge: false }>(),
  ]);

  const error = total.error ?? active.error ?? upcoming.error ?? expiring.error;
  if (error) throw new Error(`Failed to load dashboard: ${error.message}`);

  return {
    totalCount: total.count ?? 0,
    activeCount: active.count ?? 0,
    upcomingCount: upcoming.count ?? 0,
    expiring: expiring.data ?? [],
  };
}

export default async function DashboardPage() {
  const today = todayISO();
  const gymName = process.env.GYM_NAME || "the gym";
  const [{ totalCount, activeCount, upcomingCount, expiring }, month] = await Promise.all([
    getDashboardData(today),
    getBreakdown(monthStartISO(today), monthEndISO(today)),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Today is {formatDate(today)}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
        <MetricCard label="Total Clients" value={totalCount} />
        <MetricCard label="Active Members" value={activeCount} tone="emerald" />
        <MetricCard
          label="Expiring Members"
          value={expiring.length}
          tone="amber"
          hint={upcomingCount > 0 ? `+${upcomingCount} more lapsing in the next 7 days` : "Expired or due today"}
        />
        <Link href="/money" className="block rounded-xl transition hover:ring-2 hover:ring-emerald-200">
          <MetricCard
            label="Money in this month"
            value={formatMoney(month.revenue)}
            tone="emerald"
            hint={`Profit so far: ${month.revenue - month.expenses < 0 ? "−" : ""}${formatMoney(Math.abs(month.revenue - month.expenses))} →`}
          />
        </Link>
      </section>

      <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4">
          <span aria-hidden className="text-xl">⚠️</span>
          <div>
            <h2 className="font-semibold text-amber-900">Action Required: Expiring Subscriptions</h2>
            <p className="text-sm text-amber-800">
              {expiring.length === 0
                ? "No memberships have expired. Nice!"
                : `${expiring.length} member${expiring.length === 1 ? "" : "s"} expired or due today.`}
            </p>
          </div>
        </div>

        {expiring.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {expiring.map((c) => {
              const dueToday = c.expiry_date === today;
              const message = buildReminderMessage({
                name: c.name,
                packageName: c.package_name,
                expiryDate: c.expiry_date,
                gymName,
                today,
              });
              return (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/clients/${c.id}`} className="block truncate font-medium hover:text-emerald-700">
                      {c.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {c.package_name} · +{c.phone}
                      {c.trainers?.name && ` · Trainer: ${c.trainers.name}`}
                    </p>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        dueToday ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {dueToday ? "Expires today" : `Expired ${formatDate(c.expiry_date)}`}
                    </span>
                  </div>
                  <WhatsAppRemindButton url={buildWhatsAppUrl(c.phone, message)} clientName={c.name} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
