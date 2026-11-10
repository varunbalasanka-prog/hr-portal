"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { SCORE_AREAS, type ScoreInput } from "@/lib/scorecard";
import { TALENT_LANGUAGES, cleanTalentTags } from "@/lib/talent";
import { pushTo } from "@/lib/push";

type Result = { ok: boolean; message: string };

/** Keep a good candidate for future openings, tagged from fixed lists: roles, stores and languages. */
export async function setTalentPool(candidateId: string, on: boolean, tags: string[]): Promise<Result> {
  const { supabase } = await requireProfile();
  let clean: string[] = [];
  if (on) {
    const [{ data: posts }, { data: branches }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "apply_posts").maybeSingle<{ value: string[] }>(),
      supabase.from("branches").select("name"),
    ]);
    clean = cleanTalentTags(tags, [...(posts?.value ?? []), ...((branches ?? []) as { name: string }[]).map((b) => b.name), ...TALENT_LANGUAGES]);
  }
  const { data, error } = await supabase.from("candidates").update({ talent_pool: on, talent_tags: clean }).eq("id", candidateId).select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "Only this person's own HR or an admin can change their talent pool entry." };
  revalidatePath("/dashboard");
  return { ok: true, message: on ? "Saved in the talent pool." : "Removed from the talent pool." };
}

/** Call a talent pool person back for an opening: they start over in follow-up with the HR of that store. */
export async function callBackFromPool(candidateId: string, name: string, branchId: string, post: string, remark: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!branchId) return { ok: false, message: "Choose the store with the opening." };
  const { data: hr, error } = await supabase.rpc("talent_call_back", {
    p_candidate: candidateId, p_branch: branchId, p_post: post.trim().slice(0, 80), p_remark: remark.trim().slice(0, 300),
  });
  if (error) return { ok: false, message: error.message };
  const to = String(hr ?? "");
  if (to && to !== profile.username) {
    const text = `${name.slice(0, 80) || "A talent pool candidate"} was called back from the talent pool by ${profile.full_name || profile.username}${post ? ` for ${post}` : ""}. They are in your follow-up list now.`;
    await supabase.from("notifications").insert({ sender: profile.username, recipient: to, message: text });
    await pushTo(to, { title: "Talent pool call-back", body: text, url: "/dashboard" });
  }
  revalidatePath("/dashboard");
  return { ok: true, message: to === profile.username ? "Moved to your follow-up list. Call them today." : `Sent to ${to}'s follow-up list.` };
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
