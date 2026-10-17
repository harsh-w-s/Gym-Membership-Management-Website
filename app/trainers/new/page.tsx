import type { Metadata } from "next";
import Link from "next/link";
import { createTrainer } from "@/app/trainers/actions";
import { TrainerForm } from "@/components/TrainerForm";

export const metadata: Metadata = { title: "Add Trainer" };

export default function NewTrainerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/trainers" className="text-sm text-slate-500 hover:text-slate-800">
        ← All trainers
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Add Trainer</h1>
        <p className="mt-1 text-sm text-slate-500">New trainers appear in the client trainer dropdown straight away.</p>
      </header>
      <TrainerForm action={createTrainer} />
    </div>
  );
}
