import type { Metadata } from "next";
import Link from "next/link";
import { createBill } from "@/app/expenses/actions";
import { BillForm } from "@/components/ExpenseForms";

export const metadata: Metadata = { title: "Add Bill" };

export default function NewBillPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/expenses/bills" className="text-sm text-slate-500 hover:text-slate-800">
        ← Monthly bills
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Add monthly bill</h1>
      <BillForm action={createBill} />
    </div>
  );
}
