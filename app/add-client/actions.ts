"use server";

import { revalidatePath } from "next/cache";
import { isValidIntlPhone, sanitizePhone } from "@/lib/phone";
import { getSupabase } from "@/lib/supabase/server";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/types";

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "phone" | "age" | "blood_group" | "package_name" | "expiry_date" | "trainer_id", string>>;
};

/**
 * Server Action. Re-validates everything the client already checked —
 * never trust the browser, a request can be crafted by hand.
 */
export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = sanitizePhone(String(formData.get("phone") ?? ""));
  const ageRaw = String(formData.get("age") ?? "").trim();
  const bloodGroup = String(formData.get("blood_group") ?? "");
  const packageName = String(formData.get("package_name") ?? "").trim();
  const expiryDate = String(formData.get("expiry_date") ?? "");
  const trainerId = String(formData.get("trainer_id") ?? "");

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Name is required.";
  if (!isValidIntlPhone(phone)) fieldErrors.phone = "Enter 8–15 digits including country code.";
  const age = ageRaw ? Number(ageRaw) : null;
  if (age !== null && (!Number.isInteger(age) || age < 5 || age > 120)) fieldErrors.age = "Age must be 5–120.";
  if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup as BloodGroup)) fieldErrors.blood_group = "Invalid blood group.";
  if (!packageName) fieldErrors.package_name = "Package is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) fieldErrors.expiry_date = "Pick a valid date.";
  if (trainerId && !/^[0-9a-f-]{36}$/i.test(trainerId)) fieldErrors.trainer_id = "Invalid trainer.";

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }

  // INSERT INTO clients (...) VALUES (...). RLS is bypassed by the service-role
  // client; DB CHECK constraints still enforce phone format, age range, etc.
  const { error } = await getSupabase().from("clients").insert({
    name,
    phone,
    age,
    blood_group: bloodGroup || null,
    package_name: packageName,
    expiry_date: expiryDate,
    trainer_id: trainerId || null,
  });

  if (error) {
    // 23505 = unique_violation (clients.phone is UNIQUE).
    if (error.code === "23505") {
      return { status: "error", message: "A client with this phone number already exists.", fieldErrors: { phone: "Already registered." } };
    }
    console.error("createClient failed:", error);
    return { status: "error", message: "Could not save the client. Please try again." };
  }

  // Dashboard metrics/expiry list are server-rendered; refresh them.
  revalidatePath("/");
  return { status: "success", message: `${name} was added successfully.` };
}
