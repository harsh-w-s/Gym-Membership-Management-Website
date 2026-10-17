"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";
import { parseMembership, parsePayment, UUID_RE } from "@/lib/validation";

// Renewals, payments and membership corrections for one client.
// The DB triggers keep the client's fee/paid/balance/expiry totals in sync.

export type MoneyFormState = FormState;

const invalid = (fieldErrors: Record<string, string>): MoneyFormState => ({
  status: "error",
  message: "Please fix the highlighted fields.",
  fieldErrors,
});

function failed(action: string, error: unknown): MoneyFormState {
  console.error(`${action} failed:`, error);
  return { status: "error", message: "Could not save. Please try again." };
}

function done(clientId: string, flag: string): never {
  revalidatePath("/", "layout");
  redirect(`/clients/${clientId}?${flag}=1`);
}

/** New membership period + optional payment, in one transaction (Postgres function). */
export async function renewMembership(clientId: string, _prev: MoneyFormState, formData: FormData): Promise<MoneyFormState> {
  if (!UUID_RE.test(clientId)) return { status: "error", message: "Invalid client." };

  const errors: Record<string, string> = {};
  const m = parseMembership(formData, errors);
  const p = parsePayment(formData, errors, { required: false });
  if (Object.keys(errors).length > 0) return invalid(errors);

  const { error } = await getSupabase().rpc("renew_membership", {
    p_client_id: clientId,
    p_package_id: m.package_id,
    p_package_name: m.package_name,
    p_start_date: m.start_date,
    p_end_date: m.end_date,
    p_fee: m.fee,
    p_paid_amount: p?.amount ?? 0,
    p_paid_on: p?.paid_on ?? m.start_date,
    p_method: p?.method ?? "cash",
    p_received_by: p?.received_by ?? null,
    p_note: p?.note ?? null,
  });
  if (error) return failed("renewMembership", error);
  done(clientId, "renewed");
}

/** INSERT INTO payments — e.g. the rest of a part payment. Linked to the latest membership. */
export async function recordPayment(clientId: string, _prev: MoneyFormState, formData: FormData): Promise<MoneyFormState> {
  if (!UUID_RE.test(clientId)) return { status: "error", message: "Invalid client." };

  const errors: Record<string, string> = {};
  const p = parsePayment(formData, errors, { required: true });
  if (Object.keys(errors).length > 0 || !p) return invalid(errors);

  const supabase = getSupabase();
  const { data: latest } = await supabase
    .from("memberships")
    .select("id")
    .eq("client_id", clientId)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  // client_name is filled in by a DB trigger from the clients table.
  const { error } = await supabase.from("payments").insert({ ...p, client_id: clientId, client_name: "", membership_id: latest?.id ?? null });
  if (error) return failed("recordPayment", error);
  done(clientId, "paid");
}

/** Fix a wrong period (dates/fee/package). */
export async function updateMembership(
  clientId: string,
  membershipId: string,
  _prev: MoneyFormState,
  formData: FormData,
): Promise<MoneyFormState> {
  if (!UUID_RE.test(clientId) || !UUID_RE.test(membershipId)) return { status: "error", message: "Invalid membership." };

  const errors: Record<string, string> = {};
  const m = parseMembership(formData, errors);
  if (Object.keys(errors).length > 0) return invalid(errors);

  // `.eq("client_id")` too, so a crafted request can't edit another client's row.
  const { data, error } = await getSupabase()
    .from("memberships")
    .update(m)
    .eq("id", membershipId)
    .eq("client_id", clientId)
    .select("id");
  if (error) return failed("updateMembership", error);
  if (!data?.length) return { status: "error", message: "This membership no longer exists." };
  done(clientId, "saved");
}

export async function deleteMembership(clientId: string, membershipId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(clientId) || !UUID_RE.test(membershipId)) return { error: "Invalid membership." };

  // Payments linked to it are kept (membership_id becomes NULL).
  const { error } = await getSupabase().from("memberships").delete().eq("id", membershipId).eq("client_id", clientId);
  if (error) {
    console.error("deleteMembership failed:", error);
    return { error: "Could not delete. Please try again." };
  }
  done(clientId, "saved");
}

export async function deletePayment(clientId: string, paymentId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(clientId) || !UUID_RE.test(paymentId)) return { error: "Invalid payment." };

  const { error } = await getSupabase().from("payments").delete().eq("id", paymentId).eq("client_id", clientId);
  if (error) {
    console.error("deletePayment failed:", error);
    return { error: "Could not delete. Please try again." };
  }
  done(clientId, "saved");
}
