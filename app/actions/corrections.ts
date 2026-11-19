"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { localInputToIso } from "@/lib/dates";
import { CANDIDATE_FIELDS, STATUS_TARGETS, type StatusTarget } from "@/lib/corrections";

/** Admin corrections (0041_admin_corrections.sql). Each needs a reason; the database logs old -> new in Change history. */
type Result = { ok: boolean; message: string };

const done = (changed: number | undefined, what: string): Result => {
  revalidatePath("/dashboard");
  revalidatePath("/staff");
  return changed === 0 ? { ok: true, message: "Nothing was changed." } : { ok: true, message: `${what} corrected. Saved in Change history.` };
};
const clean = (m: string) => m.replace(/^.*?ERROR:\s*/, "");

export async function correctCandidate(candidateId: string, fields: Record<string, string>, reason: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const allowed = Object.fromEntries(Object.entries(fields).filter(([k]) => (CANDIDATE_FIELDS as readonly string[]).includes(k)));
  const { data, error } = await supabase.rpc("admin_correct_candidate", { p_id: candidateId, p_fields: allowed, p_reason: reason });
  if (error) return { ok: false, message: clean(error.message) };
  return done((data as { changed?: number })?.changed, "Details");
}

export async function correctOnboarding(candidateId: string, details: Record<string, string>, reason: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_correct_onboarding", { p_candidate: candidateId, p_details: details, p_reason: reason });
  if (error) return { ok: false, message: clean(error.message) };
  return done((data as { changed?: number })?.changed, "Onboarding details");
}

export async function correctEmployee(employeeId: string, name: string, mobile: string, reason: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_correct_employee", { p_employee: employeeId, p_name: name, p_mobile: mobile, p_reason: reason });
  if (error) return { ok: false, message: clean(error.message) };
  return done((data as { changed?: number })?.changed, "Staff details");
}

/** at: datetime-local value (interview); date: yyyy-mm-dd (expected joining or joining day). */
export async function correctStatus(candidateId: string, target: StatusTarget, at: string, date: string, reason: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  if (!STATUS_TARGETS.some((t) => t.value === target)) return { ok: false, message: "Choose the correct status." };
  const { error } = await supabase.rpc("admin_set_status", {
    p_candidate: candidateId, p_target: target, p_at: at ? localInputToIso(at) : null, p_date: date || null, p_reason: reason,
  });
  if (error) return { ok: false, message: clean(error.message) };
  revalidatePath("/dashboard");
  revalidatePath("/staff");
  return { ok: true, message: "Status corrected. Saved in History and Change history." };
}

export async function undoLeaving(employmentId: string, reason: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_undo_leaving", { p_employment: employmentId, p_reason: reason });
  if (error) return { ok: false, message: clean(error.message) };
  revalidatePath("/staff");
  return { ok: true, message: "Back to working. Saved in Change history." };
}
