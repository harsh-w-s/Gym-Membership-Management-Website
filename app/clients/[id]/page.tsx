import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteClient } from "@/app/clients/actions";
import { deletePayment } from "@/app/clients/[id]/money-actions";
import { DeleteButton } from "@/components/DeleteButton";
import { primaryBtn, secondaryBtn } from "@/components/form";
import { PaymentBadge, StatusBadge } from "@/components/StatusBadge";
import { WhatsAppRemindButton } from "@/components/WhatsAppRemindButton";
import { addDaysISO, formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import { PAYMENT_METHODS, type Client, type Membership, type Payment, type Trainer } from "@/lib/types";
import { buildReminderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Client" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type ClientFull = Client & {
  trainers: Pick<Trainer, "id" | "name"> | null;
  memberships: Membership[];
  payments: Payment[];
};

const FLASH: Record<string, string> = {
  saved: "Changes saved.",
  renewed: "Membership renewed.",
  paid: "Payment recorded.",
};

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

  // One request: the client, their trainer, every membership period and every
  // payment, newest first. "!fk_name" picks the exact foreign key to follow —
  // payments references both clients and memberships, which would otherwise
  // make the join ambiguous.
  const { data: client, error } = await getSupabase()
    .from("clients")
    .select("*, trainers(id, name), memberships!memberships_client_id_fkey(*), payments!payments_client_id_fkey(*)")
    .eq("id", id)
    .order("end_date", { referencedTable: "memberships", ascending: false })
    .order("paid_on", { referencedTable: "payments", ascending: false })
    .maybeSingle<ClientFull>();

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
  const flash = Object.keys(FLASH).find((k) => sp[k] === "1");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/clients" className="text-sm text-slate-500 hover:text-slate-800">
        ← All clients
      </Link>

      {flash && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {FLASH[flash]}
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
          <Link href={`/clients/${client.id}/renew`} className={primaryBtn}>
            Renew
          </Link>
          <Link href={`/clients/${client.id}/payment`} className={secondaryBtn}>
            Record payment
          </Link>
          <Link href={`/clients/${client.id}/edit`} className={secondaryBtn}>
            Edit
          </Link>
          <DeleteButton
            action={deleteClient.bind(null, client.id)}
            confirmText={`Delete ${client.name}? Their membership history is removed. Payment records are kept for your accounts.`}
          />
        </div>
      </header>

      {showReminder && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">Membership needs renewal soon — send a reminder.</p>
          <WhatsAppRemindButton url={reminderUrl} clientName={client.name} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card title="Personal details">
          <Row label="Phone">
            <a href={`https://wa.me/${client.phone}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
              +{client.phone}
            </a>
          </Row>
          <Row label="Age">{client.age ?? "—"}</Row>
          <Row label="Blood group">{client.blood_group ?? "—"}</Row>
          <Row label="Joined on">{formatDate(client.joined_on)}</Row>
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

        <Card title="Current membership">
          <Row label="Package">{client.package_name}</Row>
          <Row label="Valid till">{formatDate(client.expiry_date)}</Row>
          <Row label="Periods bought">{client.memberships.length}</Row>
        </Card>

        <Card title="Money (all time)">
          <Row label="Total fees">{formatMoney(client.package_fee)}</Row>
          <Row label="Total paid">{formatMoney(client.amount_paid)}</Row>
          <Row label={client.balance_due < 0 ? "Paid in advance" : "Balance due"}>
            <span className={client.balance_due > 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>
              {formatMoney(Math.abs(client.balance_due))}
            </span>
          </Row>
        </Card>
      </div>

      <Section title="Payment history" empty="No payments recorded yet." count={client.payments.length}>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Received by</th>
              <th className="hidden px-4 py-2 sm:table-cell">Note</th>
              <th className="px-4 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {client.payments.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap px-4 py-2">{formatDate(p.paid_on)}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{formatMoney(p.amount)}</td>
                <td className="px-4 py-2">{PAYMENT_METHODS[p.method]}</td>
                <td className="px-4 py-2 text-slate-600">{p.received_by ?? "—"}</td>
                <td className="hidden px-4 py-2 text-slate-500 sm:table-cell">{p.note ?? ""}</td>
                <td className="px-4 py-2 text-right">
                  <DeleteButton
                    compact
                    action={deletePayment.bind(null, client.id, p.id)}
                    confirmText={`Delete the ${formatMoney(p.amount)} payment from ${formatDate(p.paid_on)}? Only do this if it was entered by mistake.`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Membership history" empty="No membership periods." count={client.memberships.length}>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Package</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2 text-right">Fee</th>
              <th className="px-4 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {client.memberships.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 font-medium">{m.package_name}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                  {formatDate(m.start_date)} → {formatDate(m.end_date)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(m.fee)}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/clients/${client.id}/memberships/${m.id}/edit`} className="font-medium text-emerald-700 hover:text-emerald-800">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
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

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
        {title} ({count})
      </h2>
      {count === 0 ? <p className="px-5 py-6 text-sm text-slate-500">{empty}</p> : <div className="overflow-x-auto">{children}</div>}
    </section>
  );
}
