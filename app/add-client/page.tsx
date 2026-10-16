import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase/server";
import type { Trainer } from "@/lib/types";
import { AddClientForm } from "./AddClientForm";

export const metadata: Metadata = { title: "Add Client" };
export const dynamic = "force-dynamic";

export default async function AddClientPage() {
  // SELECT id, name, speciality FROM trainers ORDER BY name — feeds the dropdown.
  const { data: trainers, error } = await getSupabase()
    .from("trainers")
    .select("id, name, speciality")
    .order("name")
    .overrideTypes<Pick<Trainer, "id" | "name" | "speciality">[], { merge: false }>();

  if (error) throw new Error(`Failed to load trainers: ${error.message}`);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Add Client</h1>
        <p className="mt-1 text-sm text-slate-500">Register a new member and assign a trainer.</p>
      </header>
      <AddClientForm trainers={trainers ?? []} />
    </div>
  );
}
