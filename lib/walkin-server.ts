import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_DOB, DEFAULT_WARN_AGE, type DobRule } from "./walkin";

/** The apply page's date-of-birth question (label and minimum age), so walk-ins follow the same rule. */
export async function dobRule(supabase: SupabaseClient): Promise<DobRule> {
  const [{ data }, { data: warn }] = await Promise.all([
    supabase.from("application_questions").select("label, min_age")
      .eq("type", "date").eq("active", true).not("min_age", "is", null).order("sort_order").limit(1).maybeSingle<{ label: string; min_age: number }>(),
    supabase.from("app_settings").select("value").eq("key", "walkin_warn_age").maybeSingle<{ value: number | null }>(),
  ]);
  const warnAge = warn ? warn.value || null : DEFAULT_WARN_AGE; // 0 = switched off
  return data ? { label: data.label, minAge: data.min_age, warnAge } : { ...DEFAULT_DOB, warnAge };
}
