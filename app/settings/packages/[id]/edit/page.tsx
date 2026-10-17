import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePackage, updatePackage } from "@/app/settings/packages/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { PackageForm } from "@/components/PackageForm";
import { getSupabase } from "@/lib/supabase/server";
import type { Package } from "@/lib/types";

export const metadata: Metadata = { title: "Edit Package" };
export const dynamic = "force-dynamic";

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: pkg, error } = await getSupabase().from("packages").select("*").eq("id", id).maybeSingle<Package>();
  if (error) throw new Error(`Failed to load package: ${error.message}`);
  if (!pkg) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/settings/packages" className="text-sm text-slate-500 hover:text-slate-800">
        ← All packages
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Package</h1>
          <p className="mt-1 text-sm text-slate-500">Changes apply to new sign-ups and renewals only.</p>
        </div>
        <DeleteButton
          action={deletePackage.bind(null, pkg.id)}
          confirmText={`Delete "${pkg.name}"? Past memberships keep their package name. Tip: untick "Available" to just hide it.`}
        />
      </header>
      <PackageForm pkg={pkg} action={updatePackage.bind(null, pkg.id)} />
    </div>
  );
}
