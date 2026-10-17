import { todayISO } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";

// Shared server-side parsing for the membership + payment parts of forms
// (Add Client, Renew, Record Payment). Pure functions: no DB access.

export const UUID_RE = /^[0-9a-f-]{36}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isISODate = (d: string) => DATE_RE.test(d);

type Errors = Record<string, string>;
const getter = (formData: FormData) => (k: string) => String(formData.get(k) ?? "").trim();

/**
 * Membership period: package (optional id + name), start, end, fee.
 * `startKey` lets Add Client use its "joined_on" field as the start date.
 */
export function parseMembership(formData: FormData, errors: Errors, startKey = "start_date") {
  const get = getter(formData);
  const packageId = get("package_id");
  const packageName = get("package_name");
  const startDate = get(startKey);
  const endDate = get("end_date");
  const fee = parseMoney(get("fee"));

  if (packageId && !UUID_RE.test(packageId)) errors.package_name = "Invalid package.";
  if (!packageName) errors.package_name = "Pick a package or type a name.";
  else if (packageName.length > 60) errors.package_name = "Keep it under 60 characters.";
  if (!isISODate(startDate)) errors[startKey] = "Pick a valid date.";
  if (!isISODate(endDate)) errors.end_date = "Pick a valid date.";
  else if (isISODate(startDate) && endDate < startDate) errors.end_date = "Expiry can't be before the start date.";
  if (Number.isNaN(fee)) errors.fee = "Enter a valid amount, e.g. 4500.";

  return {
    package_id: packageId || null,
    package_name: packageName,
    start_date: startDate,
    end_date: endDate,
    fee: fee ?? 0,
  };
}

/**
 * Payment. When `required` is false an empty amount means "no payment now".
 * Returns null in that case.
 */
export function parsePayment(formData: FormData, errors: Errors, { required }: { required: boolean }) {
  const get = getter(formData);
  const amount = parseMoney(get("amount"));
  const paidOn = get("paid_on");
  const method = get("method");
  const receivedBy = get("received_by");
  const note = get("note");

  if (amount === null || amount === 0) {
    if (required) errors.amount = "Enter the amount received.";
    return null;
  }
  if (Number.isNaN(amount) || amount < 0) {
    errors.amount = "Enter a valid amount, e.g. 1500.";
    return null;
  }
  if (!isISODate(paidOn)) errors.paid_on = "Pick a valid date.";
  else if (paidOn > todayISO()) errors.paid_on = "Payment date can't be in the future.";
  if (!(method in PAYMENT_METHODS)) errors.method = "Pick how they paid.";
  if (receivedBy.length > 100) errors.received_by = "Too long.";
  if (note.length > 200) errors.note = "Keep the note under 200 characters.";

  return {
    amount,
    paid_on: paidOn,
    method: method as PaymentMethod,
    received_by: receivedBy || null,
    note: note || null,
  };
}
