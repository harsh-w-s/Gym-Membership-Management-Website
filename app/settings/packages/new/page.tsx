import type { Metadata } from "next";
import Link from "next/link";
import { createPackage } from "@/app/settings/packages/actions";
import { PackageForm } from "@/components/PackageForm";

export const metadata: Metadata = { title: "Add Package" };

export default function NewPackagePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/settings/packages" className="text-sm text-slate-500 hover:text-slate-800">
        ← All packages
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Add Package</h1>
      <PackageForm action={createPackage} />
    </div>
  );
}
