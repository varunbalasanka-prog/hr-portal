"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { firmRoleNames, loadFirmRoles } from "@/lib/job-roles";
import { divisionOf } from "@/lib/staff";
import type { Branch } from "@/lib/types";
import { cleanBranchPosts, cleanQuestion, type AdminQuestion, type QuestionInput } from "@/lib/apply-questions";

type Result = { ok: boolean; message: string };

async function allQuestions(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  const { data, error } = await supabase.from("application_questions").select("*").order("sort_order").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminQuestion[];
}

function done(message: string): Result {
  revalidatePath("/admin");
  revalidatePath("/apply");
  return { ok: true, message };
}

/** Adds a question (no id) or edits one. Past applications keep the label they were answered under. */
export async function saveQuestion(id: string | null, input: QuestionInput): Promise<Result> {
  const { supabase } = await requireAdmin();
  const all = await allQuestions(supabase);
  const clean = cleanQuestion(input, all, id ?? undefined);
  if (!clean.ok) return clean;
  if (id) {
    const { error } = await supabase.from("application_questions").update({ ...clean.value, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, message: error.message };
    return done("Question saved. Past applications keep their original answers.");
  }
  const last = Math.max(0, ...all.map((q) => q.sort_order));
  const { error } = await supabase.from("application_questions").insert({ ...clean.value, sort_order: last + 10 });
  if (error) return { ok: false, message: error.message };
  return done("Question added.");
}

/** Moves a live question one place up or down. */
export async function moveQuestion(id: string, dir: -1 | 1): Promise<Result> {
  const { supabase } = await requireAdmin();
  const live = (await allQuestions(supabase)).filter((q) => q.active);
  const i = live.findIndex((q) => q.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= live.length) return { ok: true, message: "" };
  [live[i], live[j]] = [live[j], live[i]];
  const results = await Promise.all(live.map((q, n) =>
    supabase.from("application_questions").update({ sort_order: (n + 1) * 10 }).eq("id", q.id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: failed.error.message };
  return done("Order saved.");
}

/** Delete hides the question from the form; answers already given stay on each candidate. Restore brings it back. */
export async function setQuestionActive(id: string, active: boolean): Promise<Result> {
  const { supabase } = await requireAdmin();
  const all = await allQuestions(supabase);
  const q = all.find((x) => x.id === id);
  if (!q) return { ok: false, message: "Question not found." };
  if (active && all.some((o) => o.active && o.id !== id && o.label.trim().toLowerCase() === q.label.trim().toLowerCase())) {
    return { ok: false, message: "A live question already uses this label. Rename one of them first." };
  }
  const { error } = await supabase.from("application_questions").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return done(active ? "Question restored." : "Question deleted from the form. Past answers are kept.");
}

async function branchPosts(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  const [{ data: settings, error }, { data: branches, error: bErr }, firmRoles] = await Promise.all([
    supabase.from("app_settings").select("key, value").in("key", ["apply_posts", "branch_posts"]),
    supabase.from("branches").select("id, name, division"),
    loadFirmRoles(supabase),
  ]);
  if (error || bErr) throw new Error((error ?? bErr)!.message);
  const get = (k: string) => settings?.find((r) => r.key === k)?.value;
  const stores = (branches ?? []) as Pick<Branch, "id" | "name" | "division">[];
  return {
    master: (get("apply_posts") ?? []) as string[],
    map: (get("branch_posts") ?? {}) as Record<string, string[]>,
    branchIds: stores.map((b) => b.id),
    // Each store may open only its firm's roles (0025). Null before 0025: any post on the master list.
    allowed: firmRoles && Object.fromEntries(stores.map((b) => [b.id, firmRoleNames(firmRoles.roles, firmRoles.firms[divisionOf(b as Branch)] ?? [])])),
  };
}

/** Sets which posts are open at the given branches (one store, or several when copying). */
export async function saveBranchPosts(branchIdsToSet: string[], posts: string[]): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { master, map, branchIds, allowed } = await branchPosts(supabase);
  if (!branchIdsToSet.length || branchIdsToSet.some((id) => !branchIds.includes(id))) return { ok: false, message: "Store not found." };
  const next = { ...map };
  for (const id of branchIdsToSet) next[id] = posts;
  const { error } = await supabase.from("app_settings")
    .upsert({ key: "branch_posts", value: cleanBranchPosts(next, master, branchIds, allowed), updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: error.message };
  const open = master.filter((p) => posts.includes(p) && (!allowed || branchIdsToSet.some((id) => allowed[id]?.includes(p)))).length;
  const where = branchIdsToSet.length === 1 ? "this store" : `${branchIdsToSet.length} stores`;
  return done(open ? `Saved: ${open} posts open at ${where}.` : `Saved: ${where} hidden from the apply page (no posts open).`);
}
