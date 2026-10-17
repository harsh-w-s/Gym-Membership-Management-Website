import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteClient } from "@/app/clients/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { secondaryBtn } from "@/components/form";
import { PaymentBadge, StatusBadge } from "@/components/StatusBadge";
import { WhatsAppRemindButton } from "@/components/WhatsAppRemindButton";
import { addDaysISO, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import type { Client, Trainer } from "@/lib/types";
import { buildReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Client" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type ClientWithTrainer = Client & { trainers: Pick<Trainer, "id" | "name" | "phone"> | null };

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // SELECT clients.*, trainers.id/name/phone FROM clients LEFT JOIN trainers ... WHERE clients.id = $id
  // `.maybeSingle()` returns null (instead of an error) when no row matches.
  const { data: client, error } = await getSupabase()
    .from("clients")
    .select("*, trainers(id, name, phone)")
    .eq("id", id)
    .maybeSingle<ClientWithTrainer>();

  if (error) throw new Error(`Failed to load client: ${error.message}`);
  if (!client) notFound();

  const today = todayISO();
  const showReminder = client.expiry_date <= addDaysISO(today, 7);
  const reminderUrl = buildWhatsAppUrl(
    client.phone,
    buildReminderMessage({
      name: client.name,
      packageName: client.package_name,
      expiryDate: client.expiry_date,
      gymName: process.env.GYM_NAME || "the gym",
      today,
    }),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-800">
        ← All clients
      </Link>

      {sp.saved === "1" && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved.
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge expiryDate={client.expiry_date} today={today} />
            <PaymentBadge balance={client.balance_due} format={formatMoney} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/clients/${client.id}/edit`} className={secondaryBtn}>
            Edit
          </Link>
          <DeleteButton
            action={deleteClient.bind(null, client.id)}
            confirmText={`Delete ${client.name}? This cannot be undone.`}
          />
        </div>
      </header>

      {showReminder && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">Membership needs renewal soon — send a reminder.</p>
          <WhatsAppRemindButton url={reminderUrl} clientName={client.name} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Personal details">
          <Row label="Phone">
            <a href={`https://wa.me/${client.phone}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
              +{client.phone}
            </a>
          </Row>
          <Row label="Age">{client.age ?? "—"}</Row>
          <Row label="Blood group">{client.blood_group ?? "—"}</Row>
          <Row label="Joined on">{formatDate(client.joined_on)}</Row>
        </Card>

        <Card title="Membership">
          <Row label="Package">{client.package_name}</Row>
          <Row label="Expiry date">{formatDate(client.expiry_date)}</Row>
          <Row label="Trainer">
            {client.trainers ? (
              <Link href={`/trainers/${client.trainers.id}/edit`} className="text-emerald-700 hover:underline">
                {client.trainers.name}
              </Link>
            ) : (
              "Unassigned"
            )}
          </Row>
        </Card>

        <Card title="Payment">
          <Row label="Package fee">{formatMoney(client.package_fee)}</Row>
          <Row label="Amount paid">{formatMoney(client.amount_paid)}</Row>
          <Row label={client.balance_due < 0 ? "Paid in advance" : "Balance due"}>
            <span className={client.balance_due > 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>
              {formatMoney(Math.abs(client.balance_due))}
            </span>
          </Row>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <dl className="space-y-2 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}
