import { addDaysISO, formatDate } from "@/lib/dates";

/** Colour-coded membership status, relative to `today` (YYYY-MM-DD). */
export function StatusBadge({ expiryDate, today }: { expiryDate: string; today: string }) {
  const [label, cls] =
    expiryDate < today
      ? [`Expired ${formatDate(expiryDate)}`, "bg-red-100 text-red-700"]
      : expiryDate === today
        ? ["Expires today", "bg-amber-100 text-amber-800"]
        : expiryDate <= addDaysISO(today, 7)
          ? [`Expires ${formatDate(expiryDate)}`, "bg-yellow-100 text-yellow-800"]
          : [`Active till ${formatDate(expiryDate)}`, "bg-emerald-100 text-emerald-700"];

  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

/** Green "Paid", red "Due ₹X", or blue "Advance ₹X". */
export function PaymentBadge({ balance, format }: { balance: number; format: (n: number) => string }) {
  const [label, cls] =
    balance > 0
      ? [`Due ${format(balance)}`, "bg-red-100 text-red-700"]
      : balance < 0
        ? [`Advance ${format(-balance)}`, "bg-sky-100 text-sky-700"]
        : ["Paid", "bg-emerald-100 text-emerald-700"];

  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
