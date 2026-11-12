"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { DEFAULT_EXIT_FORM, KIND_OPTIONS, STORE_KINDS, cleanExitAnswers, currentExitForm, missingAnswers, sanitizeExitForm, type ExitAnswers, type ExitForm, type StaffExit } from "@/lib/exit";
import type { ExitType } from "@/lib/staff";
import { isAdminRole } from "@/lib/types";

type Result = { ok: boolean; message: string };

const isHr = (role: string) => role === "hr" || role === "admin" || role === "superadmin";
const date = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
const kind = (k: string): ExitType | null => (KIND_OPTIONS.some((o) => o.value === k) ? (k as ExitType) : null);
const rehire = (r: string | null | undefined) => (r === "yes" || r === "no" || r === "not sure" ? r : null);
const done = (message: string): Result => { revalidatePath("/staff"); return { ok: true, message }; };

type ExitInput = { kind: string; reason: string; informed_on: string | null; last_day: string };

/** Store: raise a resignation (or absconding) for its own working staff; HR confirms. HR or admin: start any exit. */
export async function raiseExit(employmentId: string, input: ExitInput): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  const k = kind(input.kind);
  if (!k) return { ok: false, message: "Choose how they are leaving." };
  if (profile.role === "branch" && !STORE_KINDS.includes(k)) return { ok: false, message: "A store can raise a resignation or absconding only." };
  if (profile.role !== "branch" && !isHr(profile.role)) return { ok: false, message: "Not allowed." };
  if (!date(input.last_day)) return { ok: false, message: "Enter the last working day." };
  const { error } = await supabase.rpc("raise_exit", {
    p_employment: employmentId, p_kind: k, p_reason: input.reason.trim().slice(0, 500),
    p_informed_on: date(input.informed_on), p_last_day: input.last_day,
  });
  if (error) return { ok: false, message: error.message };
  return done(profile.role === "branch" ? "Sent to HR. They will confirm the last day and take the exit interview." : "Exit started. Next: the exit interview.");
}

export async function confirmExit(id: string, input: ExitInput): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!isHr(profile.role)) return { ok: false, message: "Only HR or an admin can confirm." };
  const k = kind(input.kind);
  if (!k) return { ok: false, message: "Choose how they are leaving." };
  if (!date(input.last_day)) return { ok: false, message: "Enter the last working day." };
  const { error } = await supabase.rpc("confirm_exit", {
    p_id: id, p_kind: k, p_reason: input.reason.trim().slice(0, 500), p_informed_on: date(input.informed_on), p_last_day: input.last_day,
  });
  if (error) return { ok: false, message: error.message };
  return done("Saved.");
}

/** HR saves the interview. A first save copies the questions in use; later saves keep that copy. */
export async function saveExitInterview(id: string, input: { mode: string; on: string; answers: ExitAnswers; notes: string; rehire: string | null }): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!isHr(profile.role)) return { ok: false, message: "Only HR or an admin can take the exit interview." };
  if (input.mode !== "phone" && input.mode !== "in person") return { ok: false, message: "Choose phone or in person." };
  if (!date(input.on)) return { ok: false, message: "Enter the day of the interview." };
  const { data: list, error: listError } = await supabase.rpc("exit_list");
  if (listError) return { ok: false, message: listError.message };
  const x = (list as StaffExit[]).find((e) => e.id === id);
  if (!x) return { ok: false, message: "Exit not found." };
  let form: ExitForm = x.form ?? DEFAULT_EXIT_FORM;
  if (!x.form) {
    const { data: saved } = await supabase.from("exit_form").select("form").maybeSingle<{ form: ExitForm }>();
    form = currentExitForm(saved);
  }
  const answers = cleanExitAnswers(form, input.answers);
  const missing = missingAnswers(form, answers);
  if (missing.length) return { ok: false, message: `Answer: ${missing.join(", ")}.` };
  const { error } = await supabase.rpc("save_exit_interview", {
    p_id: id, p_mode: input.mode, p_on: input.on, p_form: form, p_answers: answers,
    p_notes: input.notes.trim().slice(0, 2000), p_rehire: rehire(input.rehire),
  });
  if (error) return { ok: false, message: error.message };
  return done("Interview saved.");
}

export async function skipExitInterview(id: string, reason: string, rehireAnswer: string | null): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!isHr(profile.role)) return { ok: false, message: "Only HR or an admin can skip the interview." };
  if (!reason.trim()) return { ok: false, message: "Say why the interview was skipped." };
  const { error } = await supabase.rpc("skip_exit_interview", { p_id: id, p_reason: reason.trim().slice(0, 500), p_rehire: rehire(rehireAnswer) });
  if (error) return { ok: false, message: error.message };
  return done("Interview skipped.");
}

export async function relieveExit(id: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!isHr(profile.role)) return { ok: false, message: "Only HR or an admin can relieve." };
  const { error } = await supabase.rpc("relieve_exit", { p_id: id });
  if (error) return { ok: false, message: error.message };
  return done("Relieved. They are now in the Past list.");
}

/** The employee stays, or it was raised by mistake. */
export async function cancelExit(id: string, note: string): Promise<Result> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("cancel_exit", { p_id: id, p_note: note.trim().slice(0, 500) });
  if (error) return { ok: false, message: error.message };
  return done("Cancelled. They stay in the Current list.");
}

/** Admin edits the exit interview questions. Interviews already taken keep the questions they were taken on. */
export async function saveExitForm(input: ExitForm): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!isAdminRole(profile.role)) return { ok: false, message: "Only an admin can change the exit questions." };
  const { form, error } = sanitizeExitForm(input, new Date().toISOString().slice(0, 19));
  if (!form) return { ok: false, message: error ?? "The questions are not valid." };
  const { error: dbError } = await supabase.from("exit_form")
    .upsert({ id: 1, form, updated_by: profile.username, updated_at: new Date().toISOString() });
  if (dbError) return { ok: false, message: dbError.message };
  return done("Questions saved. New interviews use them; past interviews keep theirs.");
}
