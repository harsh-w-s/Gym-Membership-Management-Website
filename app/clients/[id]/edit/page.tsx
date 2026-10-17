import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClient } from "@/app/clients/actions";
import { ClientForm } from "@/components/ClientForm";
import { todayISO } from "@/lib/dates";
import { getTrainerOptions } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export const metadata: Metadata = { title: "Edit Client" };
export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // Load the client and the trainer dropdown in parallel.
  const [{ data: client, error }, trainers] = await Promise.all([
    getSupabase().from("clients").select("*").eq("id", id).maybeSingle<Client>(),
    getTrainerOptions(),
  ]);
  if (error) throw new Error(`Failed to load client: ${error.message}`);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/clients/${client.id}`} className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to {client.name}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Client</h1>
        <p className="mt-1 text-sm text-slate-500">Update membership, payment or contact details.</p>
      </header>
      {/* .bind fixes the first argument (id) so the form only passes (prevState, formData). */}
      <ClientForm trainers={trainers} client={client} action={updateClient.bind(null, client.id)} today={todayISO()} />
    </div>
  );
}
