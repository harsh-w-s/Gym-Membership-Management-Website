import "server-only";
import { getSupabase } from "@/lib/supabase/server";
import type { TrainerOption } from "@/lib/types";

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
