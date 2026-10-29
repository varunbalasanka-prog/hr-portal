import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_DOB, type DobRule } from "./walkin";

/** The apply page's date-of-birth question (label and minimum age), so walk-ins follow the same rule. */
export async function dobRule(supabase: SupabaseClient): Promise<DobRule> {
  const { data } = await supabase.from("application_questions").select("label, min_age")
    .eq("type", "date").eq("active", true).not("min_age", "is", null).order("sort_order").limit(1).maybeSingle<{ label: string; min_age: number }>();
  return data ? { label: data.label, minAge: data.min_age } : DEFAULT_DOB;
}
