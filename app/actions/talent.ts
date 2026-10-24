"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { SCORE_AREAS, type ScoreInput } from "@/lib/scorecard";

type Result = { ok: boolean; message: string };

/** Keep a good candidate for future openings, with tags such as "sales", "fluent English", "Theni only". */
export async function setTalentPool(candidateId: string, on: boolean, tags: string[]): Promise<Result> {
  const { supabase } = await requireProfile();
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 10);
  const { error } = await supabase.from("candidates").update({ talent_pool: on, talent_tags: on ? clean : [] }).eq("id", candidateId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: on ? "Saved in the talent pool." : "Removed from the talent pool." };
}



export async function saveScore(candidateId: string, input: ScoreInput): Promise<Result> {
  const { supabase } = await requireProfile();
  const ratings: Record<string, number> = {};
  for (const a of SCORE_AREAS) {
    const v = Math.round(Number(input.ratings[a]));
    if (v >= 1 && v <= 5) ratings[a] = v;
  }
  const vals = Object.values(ratings);
  if (vals.length === 0) return { ok: false, message: "Rate at least one area." };
  if (!["hire", "hold", "reject"].includes(input.recommendation)) return { ok: false, message: "Choose a recommendation." };
  const overall = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const { error } = await supabase.from("interview_scores").insert({
    candidate_id: candidateId, ratings, overall, recommendation: input.recommendation, notes: input.notes.trim().slice(0, 1000) || null,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Scorecard saved." };
}

export async function deleteScore(id: string): Promise<Result> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("interview_scores").delete().eq("id", id);
  return error ? { ok: false, message: error.message } : { ok: true, message: "Deleted." };
}
