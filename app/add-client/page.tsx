import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/app/clients/actions";
import { ClientForm } from "@/components/ClientForm";
import { todayISO } from "@/lib/dates";
import { getPackageOptions, getTrainerOptions, receiverOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Add Client" };
export const dynamic = "force-dynamic";

export default async function AddClientPage() {
  const [trainers, packages] = await Promise.all([getTrainerOptions(), getPackageOptions()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Add Client</h1>
        <p className="mt-1 text-sm text-slate-500">Register a new member, their package and what they paid.</p>
      </header>
      {packages.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tip: <Link href="/settings/packages/new" className="font-medium underline">set up your packages</Link> so the fee and
          expiry fill in automatically. You can still choose &quot;Custom…&quot; below.
        </p>
      )}
      <ClientForm
        trainers={trainers}
        packages={packages}
        receivers={receiverOptions(trainers)}
        action={createClient}
        today={todayISO()}
      />
    </div>
  );
}
