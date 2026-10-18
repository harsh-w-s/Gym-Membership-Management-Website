export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export type Trainer = {
  id: string;
  name: string;
  phone: string | null;
  speciality: string | null;
  salary: number; // monthly
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  age: number | null;
  blood_group: BloodGroup | null;
  // Cached totals, kept in sync by DB triggers from memberships/payments:
  package_name: string; // latest membership's package
  package_fee: number; // sum of all membership fees
  amount_paid: number; // sum of all payments
  balance_due: number; // generated column: package_fee - amount_paid
  joined_on: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD (Postgres `date`)
  trainer_id: string | null;
  created_at: string;
};

export type TrainerOption = Pick<Trainer, "id" | "name" | "speciality">;

export type Package = {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  is_active: boolean;
  created_at: string;
};

export type PackageOption = Pick<Package, "id" | "name" | "duration_months" | "price">;

/** One period a client bought. Renewals add a new row. */
export type Membership = {
  id: string;
  client_id: string;
  package_id: string | null;
  package_name: string;
  start_date: string;
  end_date: string;
  fee: number;
  created_at: string;
};

export const PAYMENT_METHODS = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
  other: "Other",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

/** One time money came in. Never overwritten. */
export type Payment = {
  id: string;
  client_id: string | null;
  client_name: string;
  membership_id: string | null;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  received_by: string | null;
  note: string | null;
  created_at: string;
};

/** Who can take money at the desk (until staff logins exist). */
export const OWNER_LABEL = "Owner";

/** Field-level errors returned by Server Actions to the forms. */
export type FormState<F extends string = string> = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<F, string>>;
};

export const EXPENSE_CATEGORIES = {
  rent: "Rent",
  electricity: "Electricity",
  water: "Water",
  internet: "Internet",
  salary: "Salary",
  equipment: "Equipment",
  maintenance: "Maintenance",
  marketing: "Marketing",
  other: "Other",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

/** One time money went out. */
export type Expense = {
  id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  spent_on: string;
  method: PaymentMethod;
  recurring_bill_id: string | null;
  trainer_id: string | null;
  bill_month: string | null; // 1st of the month this bill/salary is for
  created_at: string;
};

/** A bill that's due every month (rent, internet...). */
export type RecurringBill = {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number; // usual amount; 0 = varies
  due_day: number;
  is_active: boolean;
  created_at: string;
};
