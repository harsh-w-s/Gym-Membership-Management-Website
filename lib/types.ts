export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export type Trainer = {
  id: string;
  name: string;
  phone: string | null;
  speciality: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  age: number | null;
  blood_group: BloodGroup | null;
  package_name: string;
  expiry_date: string; // YYYY-MM-DD (Postgres `date`)
  trainer_id: string | null;
  created_at: string;
};
