import "server-only";
import { getSupabase } from "@/lib/supabase/server";
import { OWNER_LABEL, type PackageOption, type TrainerOption } from "@/lib/types";

/** SELECT id, name, speciality FROM trainers ORDER BY name — feeds trainer dropdowns. */
export async function getTrainerOptions(): Promise<TrainerOption[]> {
  const { data, error } = await getSupabase()
    .from("trainers")
    .select("id, name, speciality")
    .order("name")
    .overrideTypes<TrainerOption[], { merge: false }>();

  if (error) throw new Error(`Failed to load trainers: ${error.message}`);
  return data ?? [];
}

/** Active packages for the package picker, shortest first. */
export async function getPackageOptions(): Promise<PackageOption[]> {
  const { data, error } = await getSupabase()
    .from("packages")
    .select("id, name, duration_months, price")
    .eq("is_active", true)
    .order("duration_months")
    .order("name")
    .overrideTypes<PackageOption[], { merge: false }>();

  if (error) throw new Error(`Failed to load packages: ${error.message}`);
  return data ?? [];
}

/** "Received by" choices: the owner plus every trainer. */
export function receiverOptions(trainers: TrainerOption[]): string[] {
  return [OWNER_LABEL, ...trainers.map((t) => t.name)];
}
