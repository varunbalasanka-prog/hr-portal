"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { applyStage, isBlacklisted, reactivate, stageFor, type StageInput } from "@/lib/pipeline";
import { formatDateTime, localInputToIso, dateToIso, tomorrowIstIso } from "@/lib/dates";
import { CANDIDATE_COLUMNS, type Branch, type Candidate } from "@/lib/types";

type Result = { ok: true; message: string } | { ok: false; message: string };

async function branchUsername(supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"], c: Candidate): Promise<string | null> {
  if (c.branch_id) {
    const { data } = await supabase.from("profiles").select("username").eq("branch_id", c.branch_id).eq("role", "branch").maybeSingle();
    if (data) return data.username;
  }
  if (c.applied_locations[0]) {
    const { data: b } = await supabase.from("branches").select("id").eq("name", c.applied_locations[0]).maybeSingle();
    if (b) {
      const { data } = await supabase.from("profiles").select("username").eq("branch_id", b.id).eq("role", "branch").maybeSingle();
      if (data) return data.username;
    }
  }
  return null;
}

export async function updateCandidateStage(candidateId: string, input: StageInput): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  const { data: c } = await supabase.from("candidates").select(CANDIDATE_COLUMNS).eq("id", candidateId).single<Candidate>();
  if (!c) return { ok: false, message: "Candidate not found or not visible to you." };

  const stage = stageFor(c);
  const result = applyStage(c, stage, input);
  if (result.error) return { ok: false, message: result.error };

  const { error } = await supabase.from("candidates").update(result.patch).eq("id", c.id);
  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  const updated = { ...c, ...result.patch } as Candidate;
  await supabase.from("candidate_events").insert({
    candidate_id: c.id, actor: profile.username, stage,
    from_status: c.pipeline_status, to_status: updated.pipeline_status,
    details: input as Record<string, unknown>, remark: input.remark?.trim() || null,
  });

  for (const n of result.notify) {
    const recipient = n.recipient === "hr" ? c.assigned_hr : await branchUsername(supabase, updated);
    if (!recipient || recipient === profile.username) continue;
    await supabase.from("notifications").insert({
      sender: profile.username, recipient,
      message: n.message.replace("{interview_at}", formatDateTime(updated.interview_at)),
    });
  }

  revalidatePath("/dashboard");
  return { ok: true, message: `Saved. Status is now "${updated.pipeline_status}".` };
}

export async function addRemark(candidateId: string, remark: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!remark.trim()) return { ok: false, message: "Remark is empty." };
  const { error } = await supabase.from("candidate_events").insert({ candidate_id: candidateId, actor: profile.username, stage: "remark", remark: remark.trim() });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Remark added." };
}

export async function reactivateCandidate(candidateId: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  const { data: c } = await supabase.from("candidates").select(CANDIDATE_COLUMNS).eq("id", candidateId).single<Candidate>();
  if (!c) return { ok: false, message: "Candidate not found." };
  const r = reactivate(c);
  if (r.error) return { ok: false, message: r.error };
  const { error } = await supabase.from("candidates").update(r.patch).eq("id", c.id);
  if (error) return { ok: false, message: error.message };
  await supabase.from("candidate_events").insert({ candidate_id: c.id, actor: profile.username, stage: "reactivate", from_status: c.pipeline_status, to_status: r.patch.pipeline_status });
  revalidatePath("/dashboard");
  return { ok: true, message: "Candidate reactivated." };
}

export interface WalkinInput {
  name: string;
  mobile: string;
  maritalStatus: string;
  address: string;
  branchId: string;
  post: string;
  interviewNeeded: "Yes" | "No";
  interviewAt?: string;
  basicSalary?: string;
  allowances?: string;
  expectedJoiningDate?: string;
  remark?: string;
}

export async function addWalkin(input: WalkinInput): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  const mobile = input.mobile.replace(/\D/g, "").slice(-10);
  if (mobile.length !== 10) return { ok: false, message: "Enter a 10-digit mobile number." };
  if (!input.name.trim()) return { ok: false, message: "Name is required." };
  const { data: branch } = await supabase.from("branches").select("*").eq("id", input.branchId).single<Branch>();
  if (!branch) return { ok: false, message: "Select a branch." };

  // Duplicate / blacklist check runs with the database's unique constraint as the final guard.
  const { data: existing } = await supabase.rpc("candidate_by_mobile", { p_mobile: mobile });
  const ex = (existing as Candidate[] | null)?.[0];
  if (ex) {
    return isBlacklisted(ex)
      ? { ok: false, message: `Mobile ${mobile} is permanently blacklisted (${ex.rejection_reason || ex.pipeline_status}) and cannot re-apply.` }
      : { ok: false, message: `Mobile ${mobile} already exists (${ex.name}, ${ex.pipeline_status}).` };
  }

  const interview = input.interviewNeeded === "Yes";
  const interviewAt = interview ? localInputToIso(input.interviewAt) : null;
  if (interview && !interviewAt) return { ok: false, message: "Enter the interview date and time." };
  if (!interview && !input.expectedJoiningDate) return { ok: false, message: "Enter the expected joining date." };

  const { data: inserted, error } = await supabase.from("candidates").insert({
    source: "walkin", name: input.name.trim(), mobile, marital_status: input.maritalStatus || null, address: input.address || null,
    posts: [input.post], applied_locations: [branch.name], branch_id: interview ? null : branch.id,
    designation: interview ? null : input.post, assigned_hr: branch.hr_username, entry_by: profile.username,
    interview_needed: interview,
    pipeline_status: interview ? "Interview Scheduled" : "Expected Joining",
    interview_at: interviewAt,
    expected_joining_date: interview ? null : input.expectedJoiningDate,
    basic_salary: Number(input.basicSalary || 0), allowances: Number(input.allowances || 0),
    next_action: interview ? "Check interview attendance" : `Check joining status (${input.expectedJoiningDate})`,
    next_action_at: interview ? interviewAt : dateToIso(input.expectedJoiningDate) ?? tomorrowIstIso(),
  }).select("id").single();
  if (error) return { ok: false, message: error.code === "23505" ? `Mobile ${mobile} already exists.` : error.message };

  if (input.remark?.trim()) {
    await supabase.from("candidate_events").insert({ candidate_id: inserted.id, actor: profile.username, stage: "walkin", remark: input.remark.trim() });
  }
  if (branch.hr_username !== profile.username) {
    await supabase.from("notifications").insert({ sender: profile.username, recipient: branch.hr_username, message: `New walk-in candidate: ${input.name} (${mobile}) at ${branch.name}.` });
  }
  revalidatePath("/dashboard");
  return { ok: true, message: "Walk-in saved." };
}

export async function setOnboardingStatus(candidateId: string, status: "pending" | "completed", missingDocs: string[] = []): Promise<Result> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("onboarding_submissions")
    .update({ status, missing_docs: status === "pending" ? missingDocs : [] }).eq("candidate_id", candidateId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: status === "completed" ? "Marked as completed." : "Marked as pending." };
}

export async function setEmployeeDetails(candidateId: string, employeeCode: string, shiftTime: string): Promise<Result> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("onboarding_submissions")
    .update({ employee_code: employeeCode || null, shift_time: shiftTime || null }).eq("candidate_id", candidateId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Employee code and shift saved." };
}
