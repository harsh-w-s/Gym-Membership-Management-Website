"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseMoney } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

export type PackageFormState = FormState<"name" | "duration_months" | "price">;

const UUID = /^[0-9a-f-]{36}$/i;

function parsePackageForm(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("name");
  const duration = Number(get("duration_months"));
  const price = parseMoney(get("price"));
  const isActive = formData.get("is_active") === "on";

  const errors: PackageFormState["fieldErrors"] = {};
  if (!name) errors.name = "Name is required.";
  else if (name.length > 60) errors.name = "Keep it under 60 characters.";
  if (!Number.isInteger(duration) || duration < 1 || duration > 36) errors.duration_months = "Pick 1–36 months.";
  if (price === null || Number.isNaN(price)) errors.price = "Enter a valid price, e.g. 4500.";

  if (Object.keys(errors).length > 0) return { errors } as const;
  return { row: { name, duration_months: duration, price: price as number, is_active: isActive } } as const;
}

function dbError(error: { code?: string; message: string }, action: string): PackageFormState {
  // 23505 = unique_violation (package names are unique, case-insensitive).
  if (error.code === "23505") {
    return { status: "error", message: "A package with this name already exists.", fieldErrors: { name: "Already exists." } };
  }
  console.error(`${action} failed:`, error);
  return { status: "error", message: "Could not save the package. Please try again." };
}

const INVALID = { status: "error", message: "Please fix the highlighted fields." } as const;

export async function createPackage(_prev: PackageFormState, formData: FormData): Promise<PackageFormState> {
  const parsed = parsePackageForm(formData);
  if ("errors" in parsed) return { ...INVALID, fieldErrors: parsed.errors };

  const { error } = await getSupabase().from("packages").insert(parsed.row);
  if (error) return dbError(error, "createPackage");

  revalidatePath("/", "layout");
  redirect("/settings/packages?saved=1");
}

export async function updatePackage(id: string, _prev: PackageFormState, formData: FormData): Promise<PackageFormState> {
  if (!UUID.test(id)) return { status: "error", message: "Invalid package." };
  const parsed = parsePackageForm(formData);
  if ("errors" in parsed) return { ...INVALID, fieldErrors: parsed.errors };

  // Changing a package only affects future sign-ups/renewals: past memberships
  // keep the name and fee they were sold with.
  const { data, error } = await getSupabase().from("packages").update(parsed.row).eq("id", id).select("id");
  if (error) return dbError(error, "updatePackage");
  if (!data?.length) return { status: "error", message: "This package no longer exists." };

  revalidatePath("/", "layout");
  redirect("/settings/packages?saved=1");
}

/** Past memberships keep their package name (FK is ON DELETE SET NULL). */
export async function deletePackage(id: string): Promise<{ error?: string }> {
  if (!UUID.test(id)) return { error: "Invalid package." };

  const { error } = await getSupabase().from("packages").delete().eq("id", id);
  if (error) {
    console.error("deletePackage failed:", error);
    return { error: "Could not delete the package. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/settings/packages?deleted=1");
}
