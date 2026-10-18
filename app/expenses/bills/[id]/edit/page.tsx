import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBill, updateBill } from "@/app/expenses/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { BillForm } from "@/components/ExpenseForms";
import { getSupabase } from "@/lib/supabase/server";
import type { RecurringBill } from "@/lib/types";

export const metadata: Metadata = { title: "Edit Bill" };
export const dynamic = "force-dynamic";

export default async function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: bill, error } = await getSupabase().from("recurring_bills").select("*").eq("id", id).maybeSingle<RecurringBill>();
  if (error) throw new Error(`Failed to load bill: ${error.message}`);
  if (!bill) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/expenses/bills" className="text-sm text-slate-500 hover:text-slate-800">
        ← Monthly bills
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Edit bill</h1>
        <DeleteButton
          action={deleteBill.bind(null, bill.id)}
          confirmText={`Delete "${bill.name}"? Past payments stay in your expenses. Tip: untick "Show in checklist" to pause it instead.`}
        />
      </header>
      <BillForm bill={bill} action={updateBill.bind(null, bill.id)} />
    </div>
  );
}
