import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { renewMembership } from "@/app/clients/[id]/money-actions";
import { RenewForm } from "@/components/MoneyForms";
import { addDaysISO, formatDate, todayISO } from "@/lib/dates";
import { getPackageOptions, getTrainerOptions, receiverOptions } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/server";
import type { Client, Membership } from "@/lib/types";

export const metadata: Metadata = { title: "Renew Membership" };
export const dynamic = "force-dynamic";

type Row = Pick<Client, "id" | "name" | "expiry_date" | "package_name"> & {
  memberships: Pick<Membership, "package_id" | "end_date">[];
};

export default async function RenewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: client, error }, packages, trainers] = await Promise.all([
    // Client + their latest membership (to preselect the same package).
    getSupabase()
      .from("clients")
      .select("id, name, expiry_date, package_name, memberships!memberships_client_id_fkey(package_id, end_date)")
      .eq("id", id)
      .order("end_date", { referencedTable: "memberships", ascending: false })
      .limit(1, { referencedTable: "memberships" })
      .maybeSingle<Row>(),
    getPackageOptions(),
    getTrainerOptions(),
  ]);
  if (error) throw new Error(`Failed to load client: ${error.message}`);
  if (!client) notFound();

  const today = todayISO();
  // Still active -> continue from the day after expiry (no lost days).
  // Already expired -> start fresh today.
  const defaultStart = client.expiry_date >= today ? addDaysISO(client.expiry_date, 1) : today;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/clients/${client.id}`} className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to {client.name}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Renew {client.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Current: {client.package_name}, {client.expiry_date < today ? "expired" : "valid till"} {formatDate(client.expiry_date)}.
        </p>
      </header>
      <RenewForm
        action={renewMembership.bind(null, client.id)}
        clientId={client.id}
        packages={packages}
        receivers={receiverOptions(trainers)}
        today={today}
        defaultStart={defaultStart}
        defaultPackageId={client.memberships[0]?.package_id ?? null}
      />
    </div>
  );
}
