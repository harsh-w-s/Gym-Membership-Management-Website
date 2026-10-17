import type { Metadata } from "next";
import Link from "next/link";
import { primaryBtn } from "@/components/form";
import { formatMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import type { Package } from "@/lib/types";

export const metadata: Metadata = { title: "Packages" };
export const dynamic = "force-dynamic";

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // Active packages first, then by length.
  const { data, error } = await getSupabase()
    .from("packages")
    .select("*")
    .order("is_active", { ascending: false })
    .order("duration_months")
    .order("name")
    .overrideTypes<Package[], { merge: false }>();
  if (error) throw new Error(`Failed to load packages: ${error.message}`);
  const packages = data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
          <p className="mt-1 text-sm text-slate-500">
            Set each package once. Adding or renewing a client then fills in the fee and expiry date automatically.
          </p>
        </div>
        <Link href="/settings/packages/new" className={primaryBtn}>
          + Add Package
        </Link>
      </header>

      {(sp.saved === "1" || sp.deleted === "1") && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.deleted === "1" ? "Package deleted. Past memberships keep their package name." : "Package saved."}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {packages.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No packages yet. Add your first one!</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {packages.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${p.is_active ? "text-slate-900" : "text-slate-400"}`}>{p.name}</span>
                    {!p.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Hidden</span>}
                  </div>
                  <div className="text-sm text-slate-500">
                    {p.duration_months} month{p.duration_months === 1 ? "" : "s"} · {formatMoney(p.price)}
                  </div>
                </div>
                <Link href={`/settings/packages/${p.id}/edit`} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
