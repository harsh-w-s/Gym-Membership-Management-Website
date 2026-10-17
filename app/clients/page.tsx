import type { Metadata } from "next";
import Link from "next/link";
import { inputCls, primaryBtn, secondaryBtn } from "@/components/form";
import { PaymentBadge, StatusBadge } from "@/components/StatusBadge";
import { addDaysISO, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getTrainerOptions } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/server";
import { BLOOD_GROUPS, type Client } from "@/lib/types";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const SORTS = {
  expiry_asc: { label: "Expiry (soonest first)", column: "expiry_date", ascending: true },
  expiry_desc: { label: "Expiry (latest first)", column: "expiry_date", ascending: false },
  name_asc: { label: "Name (A–Z)", column: "name", ascending: true },
  joined_desc: { label: "Recently joined", column: "joined_on", ascending: false },
  due_desc: { label: "Highest balance due", column: "balance_due", ascending: false },
} as const;
type SortKey = keyof typeof SORTS;

type Row = Pick<
  Client,
  "id" | "name" | "phone" | "package_name" | "package_fee" | "amount_paid" | "balance_due" | "expiry_date" | "blood_group"
> & { trainers: { name: string } | null };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Reads a single string from the URL query, ignoring arrays/missing. */
function param(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  return typeof v === "string" ? v.trim() : "";
}

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters = {
    q: param(sp, "q"),
    status: param(sp, "status"),
    trainer: param(sp, "trainer"),
    payment: param(sp, "payment"),
    blood: param(sp, "blood"),
    pkg: param(sp, "package"),
    sort: (param(sp, "sort") in SORTS ? param(sp, "sort") : "expiry_asc") as SortKey,
    page: Math.max(1, Number.parseInt(param(sp, "page"), 10) || 1),
  };
  const today = todayISO();
  const supabase = getSupabase();

  // Build ONE query and narrow it down with each active filter.
  // `count: "exact"` also returns the total number of matches (for pagination).
  let query = supabase
    .from("clients")
    .select(
      "id, name, phone, package_name, package_fee, amount_paid, balance_due, expiry_date, blood_group, trainers(name)",
      { count: "exact" },
    );

  if (filters.q) {
    // Keep only safe characters so the search text can't alter the PostgREST
    // filter syntax (commas, parentheses and dots are operators there).
    const text = filters.q.replace(/[^\p{L}\p{N}\s'-]/gu, "").trim();
    const digits = filters.q.replace(/\D/g, "");
    const parts: string[] = [];
    if (text) parts.push(`name.ilike.*${text}*`); // case-insensitive "contains"
    if (digits.length >= 3) parts.push(`phone.like.*${digits}*`);
    if (parts.length) query = query.or(parts.join(","));
  }

  const weekAhead = addDaysISO(today, 7);
  if (filters.status === "active") query = query.gt("expiry_date", today);
  if (filters.status === "expiring") query = query.gt("expiry_date", today).lte("expiry_date", weekAhead);
  if (filters.status === "expired") query = query.lte("expiry_date", today);

  if (filters.trainer === "none") query = query.is("trainer_id", null);
  else if (/^[0-9a-f-]{36}$/i.test(filters.trainer)) query = query.eq("trainer_id", filters.trainer);

  // balance_due is a generated column (package_fee - amount_paid), so it's filterable.
  if (filters.payment === "due") query = query.gt("balance_due", 0);
  if (filters.payment === "paid") query = query.lte("balance_due", 0);

  if ((BLOOD_GROUPS as readonly string[]).includes(filters.blood)) query = query.eq("blood_group", filters.blood);

  if (filters.pkg) {
    const pkg = filters.pkg.replace(/[^\p{L}\p{N}\s'&–-]/gu, "").trim();
    if (pkg) query = query.ilike("package_name", `%${pkg}%`);
  }

  const sort = SORTS[filters.sort];
  const from = (filters.page - 1) * PAGE_SIZE;
  query = query
    .order(sort.column, { ascending: sort.ascending })
    .order("name", { ascending: true }) // stable tie-breaker
    .range(from, from + PAGE_SIZE - 1); // LIMIT/OFFSET

  const [{ data, count, error }, trainers] = await Promise.all([
    query.overrideTypes<Row[], { merge: false }>(),
    getTrainerOptions(),
  ]);
  if (error) throw new Error(`Failed to load clients: ${error.message}`);

  const rows = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(filters.q || filters.status || filters.trainer || filters.payment || filters.blood || filters.pkg);

  /** Same URL with one or more params changed — used for pagination links. */
  const withParams = (changes: Record<string, string | number>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) next.set(k, v);
    for (const [k, v] of Object.entries(changes)) next.set(k, String(v));
    return `/clients?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} {hasFilters ? "matching" : "total"} client{total === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/add-client" className={primaryBtn}>
          + Add Client
        </Link>
      </header>

      {sp.deleted === "1" && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Client deleted.
        </div>
      )}

      {/* Plain GET form: filters live in the URL, so results are bookmarkable. */}
      <form method="get" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2">
          <span className="text-xs font-medium text-slate-600">Search</span>
          <input name="q" defaultValue={filters.q} placeholder="Name or phone number" className={inputCls} />
        </label>
        <label>
          <span className="text-xs font-medium text-slate-600">Membership</span>
          <select name="status" defaultValue={filters.status} className={inputCls}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring in 7 days</option>
            <option value="expired">Expired / due today</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-medium text-slate-600">Payment</span>
          <select name="payment" defaultValue={filters.payment} className={inputCls}>
            <option value="">All</option>
            <option value="due">Balance due</option>
            <option value="paid">Fully paid</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-medium text-slate-600">Trainer</span>
          <select name="trainer" defaultValue={filters.trainer} className={inputCls}>
            <option value="">All</option>
            <option value="none">Unassigned</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-medium text-slate-600">Package</span>
          <input name="package" defaultValue={filters.pkg} placeholder="e.g. Monthly" className={inputCls} />
        </label>
        <label>
          <span className="text-xs font-medium text-slate-600">Blood group</span>
          <select name="blood" defaultValue={filters.blood} className={inputCls}>
            <option value="">All</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-medium text-slate-600">Sort by</span>
          <select name="sort" defaultValue={filters.sort} className={inputCls}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
          {hasFilters && (
            <Link href="/clients" className={secondaryBtn}>
              Clear
            </Link>
          )}
          <button type="submit" className={primaryBtn}>
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            {hasFilters ? "No clients match these filters." : "No clients yet. Add your first one!"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Membership</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="hidden px-4 py-3 md:table-cell">Trainer</th>
                  <th className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                        {c.name}
                      </Link>
                      <div className="text-xs text-slate-500">+{c.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{c.package_name}</div>
                      <div className="text-xs text-slate-500">{formatMoney(c.package_fee)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge expiryDate={c.expiry_date} today={today} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentBadge balance={c.balance_due} format={formatMoney} />
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{c.trainers?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link href={`/clients/${c.id}`} className="font-medium text-slate-600 hover:text-slate-900">
                        View
                      </Link>
                      <span className="mx-2 text-slate-300">|</span>
                      <Link href={`/clients/${c.id}/edit`} className="font-medium text-emerald-700 hover:text-emerald-800">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-slate-500">
            Page {filters.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {filters.page > 1 && (
              <Link href={withParams({ page: filters.page - 1 })} className={secondaryBtn}>
                ← Previous
              </Link>
            )}
            {filters.page < totalPages && (
              <Link href={withParams({ page: filters.page + 1 })} className={secondaryBtn}>
                Next →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
