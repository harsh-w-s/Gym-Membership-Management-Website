import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { recordPayment } from "@/app/clients/[id]/money-actions";
import { PaymentForm } from "@/components/MoneyForms";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getTrainerOptions, receiverOptions } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export const metadata: Metadata = { title: "Record Payment" };
export const dynamic = "force-dynamic";

export default async function RecordPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: client, error }, trainers] = await Promise.all([
    getSupabase().from("clients").select("id, name, balance_due").eq("id", id).maybeSingle<Pick<Client, "id" | "name" | "balance_due">>(),
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
        <h1 className="text-2xl font-semibold tracking-tight">Record payment</h1>
        <p className="mt-1 text-sm text-slate-500">
          {client.name}
          {client.balance_due > 0 ? ` · Balance due: ${formatMoney(client.balance_due)}` : " · Nothing due right now"}
        </p>
      </header>
      <PaymentForm
        action={recordPayment.bind(null, client.id)}
        clientId={client.id}
        receivers={receiverOptions(trainers)}
        today={todayISO()}
        suggested={client.balance_due}
      />
    </div>
  );
}
