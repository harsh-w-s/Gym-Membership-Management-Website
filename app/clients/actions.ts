"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayISO } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import { isValidIntlPhone, sanitizePhone } from "@/lib/phone";
import { getSupabase } from "@/lib/supabase/server";
import { BLOOD_GROUPS, type BloodGroup, type FormState } from "@/lib/types";

type ClientField =
  | "name"
  | "phone"
  | "age"
  | "blood_group"
  | "package_name"
  | "package_fee"
  | "amount_paid"
  | "joined_on"
  | "expiry_date"
  | "trainer_id";

export type ClientFormState = FormState<ClientField>;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Validates the form on the server — never trust the browser, a request can
 * be crafted by hand. Returns either a DB-ready row or field errors.
 */
function parseClientForm(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const name = get("name");
  const phone = sanitizePhone(get("phone"));
  const ageRaw = get("age");
  const bloodGroup = get("blood_group");
  const packageName = get("package_name");
  const packageFee = parseMoney(get("package_fee"));
  const amountPaid = parseMoney(get("amount_paid"));
  const joinedOn = get("joined_on");
  const expiryDate = get("expiry_date");
  const trainerId = get("trainer_id");

  const errors: ClientFormState["fieldErrors"] = {};
  if (!name) errors.name = "Name is required.";
  if (!isValidIntlPhone(phone)) errors.phone = "Enter 8–15 digits including country code.";
  const age = ageRaw ? Number(ageRaw) : null;
  if (age !== null && (!Number.isInteger(age) || age < 5 || age > 120)) errors.age = "Age must be 5–120.";
  if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup as BloodGroup)) errors.blood_group = "Invalid blood group.";
  if (!packageName) errors.package_name = "Package is required.";
  if (Number.isNaN(packageFee)) errors.package_fee = "Enter a valid amount, e.g. 1500 or 1500.50.";
  if (Number.isNaN(amountPaid)) errors.amount_paid = "Enter a valid amount, e.g. 1500 or 1500.50.";
  const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!isDate(joinedOn)) errors.joined_on = "Pick a valid date.";
  else if (joinedOn > todayISO()) errors.joined_on = "Joining date can't be in the future.";
  if (!isDate(expiryDate)) errors.expiry_date = "Pick a valid date.";
  else if (isDate(joinedOn) && expiryDate < joinedOn) errors.expiry_date = "Expiry can't be before the joining date.";
  if (trainerId && !UUID.test(trainerId)) errors.trainer_id = "Invalid trainer.";

  if (Object.keys(errors).length > 0) return { errors } as const;

  return {
    row: {
      name,
      phone,
      age,
      blood_group: bloodGroup || null,
      package_name: packageName,
      package_fee: packageFee ?? 0,
      amount_paid: amountPaid ?? 0,
      joined_on: joinedOn,
      expiry_date: expiryDate,
      trainer_id: trainerId || null,
    },
  } as const;
}

function dbError(error: { code?: string; message: string }, action: string): ClientFormState {
  // 23505 = unique_violation (clients.phone is UNIQUE).
  if (error.code === "23505") {
    return {
      status: "error",
      message: "A client with this phone number already exists.",
      fieldErrors: { phone: "Already registered." },
    };
  }
  console.error(`${action} failed:`, error);
  return { status: "error", message: "Could not save the client. Please try again." };
}

const INVALID: Pick<ClientFormState, "status" | "message"> = {
  status: "error",
  message: "Please fix the highlighted fields.",
};

export async function createClient(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const parsed = parseClientForm(formData);
  if ("errors" in parsed) return { ...INVALID, fieldErrors: parsed.errors };

  // INSERT INTO clients (...) VALUES (...). DB CHECK constraints are a second safety net.
  const { error } = await getSupabase().from("clients").insert(parsed.row);
  if (error) return dbError(error, "createClient");

  revalidatePath("/", "layout"); // refresh dashboard + clients list
  return { status: "success", message: `${parsed.row.name} was added successfully.` };
}

/** Bound to the client id in the edit page: updateClient.bind(null, id). */
export async function updateClient(id: string, _prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  if (!UUID.test(id)) return { status: "error", message: "Invalid client." };

  const parsed = parseClientForm(formData);
  if ("errors" in parsed) return { ...INVALID, fieldErrors: parsed.errors };

  // UPDATE clients SET ... WHERE id = $id. `.select("id")` returns the updated
  // row so we can tell "not found" apart from success.
  const { data, error } = await getSupabase().from("clients").update(parsed.row).eq("id", id).select("id");
  if (error) return dbError(error, "updateClient");
  if (!data?.length) return { status: "error", message: "This client no longer exists." };

  revalidatePath("/", "layout");
  redirect(`/clients/${id}?saved=1`);
}

/** Bound to the client id: deleteClient.bind(null, id). */
export async function deleteClient(id: string): Promise<{ error?: string }> {
  if (!UUID.test(id)) return { error: "Invalid client." };

  // DELETE FROM clients WHERE id = $id
  const { error } = await getSupabase().from("clients").delete().eq("id", id);
  if (error) {
    console.error("deleteClient failed:", error);
    return { error: "Could not delete the client. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/clients?deleted=1");
}
