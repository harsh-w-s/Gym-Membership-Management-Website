import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMembership, updateMembership } from "@/app/clients/[id]/money-actions";
import { DeleteButton } from "@/components/DeleteButton";
import { MembershipEditForm } from "@/components/MoneyForms";
import { getPackageOptions } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/server";
import type { Membership } from "@/lib/types";

export const metadata: Metadata = { title: "Edit Membership" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditMembershipPage({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  if (!UUID.test(id) || !UUID.test(mid)) notFound();

  const [{ data: membership, error }, packages] = await Promise.all([
    getSupabase()
      .from("memberships")
      .select("*, clients!memberships_client_id_fkey(name)")
      .eq("id", mid)
      .eq("client_id", id)
      .maybeSingle<Membership & { clients: { name: string } | null }>(),
    getPackageOptions(),
  ]);
  if (error) throw new Error(`Failed to load membership: ${error.message}`);
  if (!membership) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to {membership.clients?.name ?? "client"}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit membership</h1>
          <p className="mt-1 text-sm text-slate-500">Use this to fix a mistake. For a new period, use Renew instead.</p>
        </div>
        <DeleteButton
          action={deleteMembership.bind(null, id, mid)}
          confirmText="Delete this membership period? Its fee is removed from the client's total. Payments are kept."
        />
      </header>
      <MembershipEditForm
        action={updateMembership.bind(null, id, mid)}
        clientId={id}
        packages={packages}
        membership={membership}
      />
    </div>
  );
}
