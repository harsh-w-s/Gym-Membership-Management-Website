import type { Metadata } from "next";
import { createClient } from "@/app/clients/actions";
import { ClientForm } from "@/components/ClientForm";
import { getTrainerOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Add Client" };
export const dynamic = "force-dynamic";

export default async function AddClientPage() {
  const trainers = await getTrainerOptions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Add Client</h1>
        <p className="mt-1 text-sm text-slate-500">Register a new member and assign a trainer.</p>
      </header>
      <ClientForm trainers={trainers} action={createClient} />
    </div>
  );
}
