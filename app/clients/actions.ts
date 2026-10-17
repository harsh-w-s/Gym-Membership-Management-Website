"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayISO } from "@/lib/dates";
import { isValidIntlPhone, sanitizePhone } from "@/lib/phone";
import { getSupabase } from "@/lib/supabase/server";
import { BLOOD_GROUPS, type BloodGroup, type FormState } from "@/lib/types";
import { isISODate, parseMembership, parsePayment, UUID_RE } from "@/lib/validation";

export type ClientFormState = FormState;

/**
 * Personal details shared by Add and Edit. Validated on the server — never
 * trust the browser, a request can be crafted by hand.
 */
function parsePersonal(formData: FormData, errors: Record<string, string>) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const name = get("name");
  const phone = sanitizePhone(get("phone"));
  const ageRaw = get("age");
  const bloodGroup = get("blood_group");
  const trainerId = get("trainer_id");
  const joinedOn = get("joined_on");

  if (!name) errors.name = "Name is required.";
  else if (name.length > 100) errors.name = "Keep it under 100 characters.";
  if (!isValidIntlPhone(phone)) errors.phone = "Enter 8–15 digits including country code.";
  const age = ageRaw ? Number(ageRaw) : null;
  if (age !== null && (!Number.isInteger(age) || age < 5 || age > 120)) errors.age = "Age must be 5–120.";
  if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup as BloodGroup)) errors.blood_group = "Invalid blood group.";
  if (trainerId && !UUID_RE.test(trainerId)) errors.trainer_id = "Invalid trainer.";
  if (!isISODate(joinedOn)) errors.joined_on = "Pick a valid date.";
  else if (joinedOn > todayISO()) errors.joined_on = "Joining date can't be in the future.";

  return { name, phone, age, blood_group: bloodGroup || null, trainer_id: trainerId || null, joined_on: joinedOn };
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
  return { status: "error", message: "Could not save. Please try again." };
}

const invalid = (fieldErrors: Record<string, string>): ClientFormState => ({
  status: "error",
  message: "Please fix the highlighted fields.",
  fieldErrors,
});

/** Add Client = client + first membership + (optional) first payment, in one transaction. */
export async function createClient(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const errors: Record<string, string> = {};
  const person = parsePersonal(formData, errors);
  // The joining date is also the first membership's start date.
  const membership = parseMembership(formData, errors, "joined_on");
  const payment = parsePayment(formData, errors, { required: false });
  if (Object.keys(errors).length > 0) return invalid(errors);

  // Postgres function (see migration): inserts all three rows atomically, so a
  // failure (e.g. duplicate phone) never leaves a half-created client behind.
  const { error } = await getSupabase().rpc("create_client_with_membership", {
    p_name: person.name,
    p_phone: person.phone,
    p_age: person.age,
    p_blood_group: person.blood_group,
    p_trainer_id: person.trainer_id,
    p_joined_on: person.joined_on,
    p_package_id: membership.package_id,
    p_package_name: membership.package_name,
    p_end_date: membership.end_date,
    p_fee: membership.fee,
    p_paid_amount: payment?.amount ?? 0,
    p_paid_on: payment?.paid_on ?? person.joined_on,
    p_method: payment?.method ?? "cash",
    p_received_by: payment?.received_by ?? null,
  });
  if (error) return dbError(error, "createClient");

  revalidatePath("/", "layout"); // refresh dashboard + clients list
  return { status: "success", message: `${person.name} was added successfully.` };
}

/**
 * Edit personal details only. Package, fee, expiry and payments are changed
 * through memberships/payments (Renew, Record payment) so history stays intact.
 */
export async function updateClient(id: string, _prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  if (!UUID_RE.test(id)) return { status: "error", message: "Invalid client." };

  const errors: Record<string, string> = {};
  const person = parsePersonal(formData, errors);
  if (Object.keys(errors).length > 0) return invalid(errors);

  // UPDATE clients SET ... WHERE id = $id. `.select("id")` tells "not found" apart from success.
  const { data, error } = await getSupabase().from("clients").update(person).eq("id", id).select("id");
  if (error) return dbError(error, "updateClient");
  if (!data?.length) return { status: "error", message: "This client no longer exists." };

  revalidatePath("/", "layout");
  redirect(`/clients/${id}?saved=1`);
}

/**
 * DELETE FROM clients WHERE id = $id. Memberships go with it; payments are
 * KEPT (client_id set to NULL, name snapshot remains) so revenue stays correct.
 */
export async function deleteClient(id: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(id)) return { error: "Invalid client." };

  const { error } = await getSupabase().from("clients").delete().eq("id", id);
  if (error) {
    console.error("deleteClient failed:", error);
    return { error: "Could not delete the client. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/clients?deleted=1");
}
