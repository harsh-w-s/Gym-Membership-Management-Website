import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTrainer, updateTrainer } from "@/app/trainers/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { StatusBadge } from "@/components/StatusBadge";
import { TrainerForm } from "@/components/TrainerForm";
import { todayISO } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase/server";
import type { Client, Trainer } from "@/lib/types";

export const metadata: Metadata = { title: "Edit Trainer" };
export const dynamic = "force-dynamic";

type TrainerWithClients = Trainer & { clients: Pick<Client, "id" | "name" | "package_name" | "expiry_date">[] };

export default async function EditTrainerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // Trainer + their assigned clients in one request (embedded via the trainer_id FK).
  const { data: trainer, error } = await getSupabase()
    .from("trainers")
    .select("*, clients(id, name, package_name, expiry_date)")
    .eq("id", id)
    .order("name", { referencedTable: "clients" })
    .maybeSingle<TrainerWithClients>();

  if (error) throw new Error(`Failed to load trainer: ${error.message}`);
  if (!trainer) notFound();

  const today = todayISO();
  const count = trainer.clients.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/trainers" className="text-sm text-slate-500 hover:text-slate-800">
        ← All trainers
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Trainer</h1>
          <p className="mt-1 text-sm text-slate-500">{trainer.name}</p>
        </div>
        <DeleteButton
          action={deleteTrainer.bind(null, trainer.id)}
          confirmText={
            count > 0
              ? `Delete ${trainer.name}? Their ${count} client${count === 1 ? "" : "s"} will be kept but become unassigned.`
              : `Delete ${trainer.name}? This cannot be undone.`
          }
        />
      </header>

      <TrainerForm trainer={trainer} action={updateTrainer.bind(null, trainer.id)} />

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
          Assigned clients ({count})
        </h2>
        {count === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No clients assigned yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {trainer.clients.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                    {c.name}
                  </Link>
                  <div className="text-xs text-slate-500">{c.package_name}</div>
                </div>
                <StatusBadge expiryDate={c.expiry_date} today={today} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
