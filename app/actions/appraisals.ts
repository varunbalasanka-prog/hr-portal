"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { FORMS, cleanAnswers, type Answers, type Appraisal, type FormKind } from "@/lib/appraisal";
import { isAdminRole } from "@/lib/types";

type Result = { ok: boolean; message: string; id?: string };

const canAppraise = (role: string) => role === "hr" || role === "admin" || role === "superadmin";
const validDate = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

/** Step 1: HR or an admin records the interview. A new appraisal uses the current form for the store's business type;
 *  an existing one keeps the form it was started on. */
export async function saveAppraisalInterview(input: { id: string | null; employment_id: string; cycle: string; kind: FormKind; interview_on: string | null; answers: Answers }): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!canAppraise(profile.role)) return { ok: false, message: "Only HR or an admin can take an appraisal interview." };
  let form = FORMS[input.kind];
  let cycle = input.cycle;
  if (input.id) {
    const { data, error } = await supabase.rpc("appraisal_list").eq("id", input.id).single();
    if (error || !data) return { ok: false, message: "Appraisal not found." };
    form = (data as Appraisal).form;
    cycle = (data as Appraisal).cycle;
  }
  if (!form) return { ok: false, message: "This store has no appraisal form yet." };
  if (!/^\d{4}-\d{2}$/.test(cycle)) return { ok: false, message: "Unknown appraisal year." };
  const { data, error } = await supabase.rpc("save_appraisal_interview", {
    p_id: input.id, p_employment: input.employment_id, p_cycle: cycle, p_interview_on: validDate(input.interview_on),
    p_form: form, p_answers: cleanAnswers(form, cycle, input.answers),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/staff");
  return { ok: true, message: "Interview saved.", id: data as string };
}

/** Step 2: propose the new salary (and designation, for a promotion). Admins are told. */
export async function proposeAppraisal(input: { id: string; designation: string; basic: number; allowances: number; effective_from: string; note: string }): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!canAppraise(profile.role)) return { ok: false, message: "Only HR or an admin can propose an appraisal." };
  const basic = Number(input.basic);
  const allowances = Number(input.allowances || 0);
  if (!(basic > 0) || !(allowances >= 0)) return { ok: false, message: "Enter the new basic salary and allowances." };
  if (!validDate(input.effective_from)) return { ok: false, message: "Enter the date the new salary starts." };
  const { error } = await supabase.rpc("propose_appraisal", {
    p_id: input.id, p_designation: input.designation.trim().slice(0, 120), p_basic: basic, p_allowances: allowances,
    p_effective: input.effective_from, p_note: input.note.trim().slice(0, 1000),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/staff");
  return { ok: true, message: "Sent to admin for approval." };
}

/** Step 3: an admin approves (the new salary goes on the staff timeline) or turns it down. */
export async function decideAppraisal(id: string, approve: boolean, note: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!isAdminRole(profile.role)) return { ok: false, message: "Only an admin can approve an appraisal." };
  const { error } = await supabase.rpc("decide_appraisal", { p_id: id, p_approve: approve, p_note: note.trim().slice(0, 1000) });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/staff");
  return { ok: true, message: approve ? "Approved. The new salary is on the staff timeline." : "Marked as not approved." };
}
