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
  package_name: string;
  package_fee: number;
  amount_paid: number;
  balance_due: number; // generated column: package_fee - amount_paid
  joined_on: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD (Postgres `date`)
  trainer_id: string | null;
  created_at: string;
};

export type TrainerOption = Pick<Trainer, "id" | "name" | "speciality">;

/** Field-level errors returned by Server Actions to the forms. */
export type FormState<F extends string = string> = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<F, string>>;
};
