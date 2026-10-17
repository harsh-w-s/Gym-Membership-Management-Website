"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseMoney } from "@/lib/money";
import { isValidIntlPhone, sanitizePhone } from "@/lib/phone";
import { getSupabase } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

export type TrainerFormState = FormState<"name" | "phone" | "speciality" | "salary">;

const UUID = /^[0-9a-f-]{36}$/i;

function parseTrainerForm(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const name = get("name");
  const phone = sanitizePhone(get("phone"));
  const speciality = get("speciality");
  const salary = parseMoney(get("salary"));

  const errors: TrainerFormState["fieldErrors"] = {};
  if (!name) errors.name = "Name is required.";
  // Phone is optional for trainers, but must be valid if given.
  if (phone && !isValidIntlPhone(phone)) errors.phone = "Enter 8–15 digits including country code.";
  if (speciality.length > 80) errors.speciality = "Keep it under 80 characters.";
  if (Number.isNaN(salary)) errors.salary = "Enter a valid amount, e.g. 25000.";

  if (Object.keys(errors).length > 0) return { errors } as const;

  return {
    row: {
      name,
      phone: phone || null,
      speciality: speciality || null,
      salary: salary ?? 0,
    },
  } as const;
}

const INVALID = { status: "error", message: "Please fix the highlighted fields." } as const;
const FAILED: TrainerFormState = { status: "error", message: "Could not save the trainer. Please try again." };

export async function createTrainer(_prev: TrainerFormState, formData: FormData): Promise<TrainerFormState> {
  const parsed = parseTrainerForm(formData);
  if ("errors" in parsed) return { ...INVALID, fieldErrors: parsed.errors };

  // INSERT INTO trainers (...) VALUES (...)
  const { error } = await getSupabase().from("trainers").insert(parsed.row);
  if (error) {
    console.error("createTrainer failed:", error);
    return FAILED;
  }

  revalidatePath("/", "layout"); // trainer dropdowns + trainers list
  redirect("/trainers?saved=1");
}

/** Bound to the trainer id: updateTrainer.bind(null, id). */
export async function updateTrainer(id: string, _prev: TrainerFormState, formData: FormData): Promise<TrainerFormState> {
  if (!UUID.test(id)) return { status: "error", message: "Invalid trainer." };

  const parsed = parseTrainerForm(formData);
  if ("errors" in parsed) return { ...INVALID, fieldErrors: parsed.errors };

  // UPDATE trainers SET ... WHERE id = $id
  const { data, error } = await getSupabase().from("trainers").update(parsed.row).eq("id", id).select("id");
  if (error) {
    console.error("updateTrainer failed:", error);
    return FAILED;
  }
  if (!data?.length) return { status: "error", message: "This trainer no longer exists." };

  revalidatePath("/", "layout");
  redirect("/trainers?saved=1");
}

/**
 * DELETE FROM trainers WHERE id = $id. The FK is ON DELETE SET NULL,
 * so their clients are kept and simply become "unassigned".
 */
export async function deleteTrainer(id: string): Promise<{ error?: string }> {
  if (!UUID.test(id)) return { error: "Invalid trainer." };

  const { error } = await getSupabase().from("trainers").delete().eq("id", id);
  if (error) {
    console.error("deleteTrainer failed:", error);
    return { error: "Could not delete the trainer. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/trainers?deleted=1");
}
