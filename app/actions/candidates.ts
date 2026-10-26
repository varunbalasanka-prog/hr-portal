"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { pushTo } from "@/lib/push";
import { applyStage, isBlacklisted, reactivate, stageFor, walkinBlocked, type StageInput } from "@/lib/pipeline";
import { formatDateTime, localInputToIso, dateToIso, todayIst, tomorrowIstIso } from "@/lib/dates";
import { CANDIDATE_COLUMNS, type Branch, type Candidate } from "@/lib/types";

type Result = { ok: true; message: string } | { ok: false; message: string; blocked?: string };

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

  // A new branch (interview store, or branch after selection) hands the candidate to that branch's HR (database trigger).
  let newHr: string | null = null;
  if (result.patch.branch_id && result.patch.branch_id !== c.branch_id) {
    const { data: b } = await supabase.from("branches").select("hr_username").eq("id", result.patch.branch_id).single<{ hr_username: string }>();
    if (b && b.hr_username !== c.assigned_hr) newHr = b.hr_username;
  }
  const updated = { ...c, ...result.patch, ...(newHr ? { assigned_hr: newHr } : {}) } as Candidate;

  // History first: after a transfer the current HR may no longer see the candidate, and so couldn't write it.
  await supabase.from("candidate_events").insert({
    candidate_id: c.id, actor: profile.username, stage,
    from_status: c.pipeline_status, to_status: updated.pipeline_status,
    details: { ...input, ...(newHr ? { transferred_to: newHr } : {}) } as Record<string, unknown>, remark: input.remark?.trim() || null,
  });
  // The branch is set last, through transfer_candidate(): once moved, this HR may no longer see (or update) the row.
  const { branch_id: newBranch, ...rest } = result.patch;
  const moving = !!newBranch && newBranch !== c.branch_id;
  const { error } = await supabase.from("candidates").update(moving ? rest : result.patch).eq("id", c.id);
  const { error: moveError } = !error && moving ? await supabase.rpc("transfer_candidate", { p_candidate: c.id, p_branch: newBranch }) : { error: null };
  if (error || moveError) {
    const why = (error ?? moveError)!.message;
    await supabase.from("candidate_events").insert({ candidate_id: c.id, actor: profile.username, stage: "remark", remark: `The update above was not saved: ${why}` });
    return { ok: false, message: `Could not save: ${why}` };
  }
  if (newHr && newHr !== profile.username) {
    const text = `${c.name} (${c.mobile}) has been moved to you by ${profile.username}: ${updated.pipeline_status}.`;
    await supabase.from("notifications").insert({ sender: profile.username, recipient: newHr, message: text });
    await pushTo(newHr, { title: "Candidate moved to you", body: text, url: "/dashboard" });
  }

  for (const n of result.notify) {
    const recipient = n.recipient === "hr" ? c.assigned_hr : await branchUsername(supabase, updated);
    if (!recipient || recipient === profile.username) continue;
    await supabase.from("notifications").insert({
      sender: profile.username, recipient,
      message: n.message.replace("{interview_at}", formatDateTime(updated.interview_at)),
    });
  }

  revalidatePath("/dashboard");
  return { ok: true, message: `Saved. Status is now "${updated.pipeline_status}".${newHr ? ` Moved to ${newHr}.` : ""}` };
}

export async function addRemark(candidateId: string, remark: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (!remark.trim()) return { ok: false, message: "Remark is empty." };
  const { error } = await supabase.from("candidate_events").insert({ candidate_id: candidateId, actor: profile.username, stage: "remark", remark: remark.trim() });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Remark added." };
}

/** Reopen a closed follow-up (e.g. marked Not Contactable too early). Admins only. */
export async function reactivateCandidate(candidateId: string): Promise<Result> {
  const { profile, supabase } = await requireAdmin();
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
    if (walkinBlocked(ex)) {
      const why = isBlacklisted(ex) ? "permanently blacklisted" : ex.pipeline_status.startsWith("Left") ? "left without information (absconding)" : "waiting for admin review";
      return { ok: false, blocked: `${ex.name} (${mobile}) is ${why}: ${ex.rejection_reason || ex.pipeline_status}.`, message: "This person can't be added without an admin's approval." };
    }
    return { ok: false, message: `Mobile ${mobile} already exists (${ex.name}, ${ex.pipeline_status}).` };
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
    // A salary typed at the walk-in is a proposal for an admin to approve.
    ...(Number(input.basicSalary || 0) || Number(input.allowances || 0)
      ? { proposed_basic: Number(input.basicSalary || 0), proposed_allowances: Number(input.allowances || 0), salary_status: "proposed" }
      : {}),
    next_action: interview ? "Check interview attendance" : `Check joining status (${input.expectedJoiningDate})`,
    next_action_at: interview ? interviewAt : dateToIso(input.expectedJoiningDate) ?? tomorrowIstIso(),
  }).select("id").single();
  if (error) return { ok: false, message: error.code === "23505" ? `Mobile ${mobile} already exists.` : error.message };

  if (input.remark?.trim()) {
    await supabase.from("candidate_events").insert({ candidate_id: inserted.id, actor: profile.username, stage: "walkin", remark: input.remark.trim() });
  }
  if (branch.hr_username !== profile.username) {
    const text = `New walk-in candidate: ${input.name} (${mobile}) at ${branch.name}.`;
    await supabase.from("notifications").insert({ sender: profile.username, recipient: branch.hr_username, message: text });
    await pushTo(branch.hr_username, { title: "New walk-in", body: text, url: "/dashboard" });
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

/** Employee (biometric) code and shift timing. The store must enter these once a candidate is marked Joined;
 *  the candidate then waits in "Payroll completion pending" for HR. */
export async function setEmployeeDetails(candidateId: string, employeeCode: string, shiftTime: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  const code = employeeCode.trim().slice(0, 40), shift = shiftTime.trim().slice(0, 60);
  if (!code || !shift) return { ok: false, message: "Enter both the employee code and the shift timing." };
  const { data: c } = await supabase.from("candidates").select("id, name, assigned_hr, store_details_at").eq("id", candidateId)
    .single<{ id: string; name: string; assigned_hr: string; store_details_at: string | null }>();
  if (!c) return { ok: false, message: "Candidate not found." };
  const { error } = await supabase.from("candidates")
    .update({ employee_code: code, shift_time: shift, store_details_at: c.store_details_at ?? new Date().toISOString() }).eq("id", candidateId);
  if (error) return { ok: false, message: error.message };
  await supabase.from("candidate_events").insert({ candidate_id: candidateId, actor: profile.username, stage: "joining", remark: `Employee code ${code}, shift ${shift}` });
  if (!c.store_details_at && c.assigned_hr !== profile.username) {
    const text = `${c.name}: employee code and shift entered by ${profile.full_name || profile.username}. Payroll completion pending.`;
    await supabase.from("notifications").insert({ sender: profile.username, recipient: c.assigned_hr, message: text });
    await pushTo(c.assigned_hr, { title: "Payroll completion pending", body: text, url: "/dashboard" });
  }
  revalidatePath("/dashboard");
  return { ok: true, message: "Employee code and shift saved." };
}

/** HR has checked the store's details and finished payroll: the candidate moves to the Completed list. */
export async function completePayroll(candidateId: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (profile.role === "branch") return { ok: false, message: "Only HR can complete payroll." };
  const { data: c } = await supabase.from("candidates").select("id, pipeline_status, employee_code, shift_time").eq("id", candidateId)
    .single<{ id: string; pipeline_status: string; employee_code: string | null; shift_time: string | null }>();
  if (!c || c.pipeline_status !== "Joined") return { ok: false, message: "Only joined candidates can be completed." };
  if (!c.employee_code || !c.shift_time) return { ok: false, message: "The store hasn't entered the employee code and shift yet." };
  const { error } = await supabase.from("candidates").update({ payroll_completed_at: new Date().toISOString(), payroll_completed_by: profile.username }).eq("id", candidateId);
  if (error) return { ok: false, message: error.message };
  await supabase.from("candidate_events").insert({ candidate_id: candidateId, actor: profile.username, stage: "payroll", remark: "Final payroll done, marked as completed" });
  revalidatePath("/dashboard");
  return { ok: true, message: "Payroll completed. Moved to the Completed list." };
}

/** Admin approves the salary HR proposed (or a corrected one). The offer letter opens after this. */
export async function approveSalary(candidateId: string, basic: number, allowances: number): Promise<Result> {
  const { profile, supabase } = await requireAdmin();
  if (!(basic > 0)) return { ok: false, message: "Enter the basic salary." };
  if (allowances < 0) return { ok: false, message: "Allowances can't be negative." };
  const { data: c } = await supabase.from("candidates").select("id, name, mobile, assigned_hr, proposed_basic, proposed_allowances").eq("id", candidateId)
    .single<{ id: string; name: string; mobile: string; assigned_hr: string; proposed_basic: number | null; proposed_allowances: number | null }>();
  if (!c) return { ok: false, message: "Candidate not found." };
  const { error } = await supabase.from("candidates").update({
    basic_salary: basic, allowances, salary_status: "approved", salary_approved_by: profile.username, salary_approved_at: new Date().toISOString(),
  }).eq("id", candidateId);
  if (error) return { ok: false, message: error.message };
  const changed = c.proposed_basic != null && (Number(c.proposed_basic) !== basic || Number(c.proposed_allowances ?? 0) !== allowances);
  const text = `Salary approved for ${c.name} (${c.mobile}): ₹${basic} basic + ₹${allowances} allowances${changed ? ` (proposed ₹${c.proposed_basic} + ₹${c.proposed_allowances ?? 0})` : ""}. The offer letter can be sent now.`;
  await supabase.from("candidate_events").insert({ candidate_id: candidateId, actor: profile.username, stage: "salary", remark: text });
  if (c.assigned_hr !== profile.username) {
    await supabase.from("notifications").insert({ sender: profile.username, recipient: c.assigned_hr, message: text });
    await pushTo(c.assigned_hr, { title: "Salary approved", body: text, url: "/dashboard" });
  }
  revalidatePath("/dashboard");
  return { ok: true, message: "Salary approved." };
}

/** HR approves an employee's confirmation after probation. The letter opens now and is sent from the SMS list on the 1st. */
export async function approveConfirmation(candidateId: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (profile.role === "branch") return { ok: false, message: "Only HR can approve a confirmation." };
  const { data, error } = await supabase.rpc("approve_confirmation", { p_candidate: candidateId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  const d = String(data ?? "");
  const when = d > todayIst() ? `on ${d.split("-").reverse().join("/")}` : "now";
  return { ok: true, message: `Confirmation approved. Send the letter from "SMS to send" ${when}.` };
}

/** HR saw the candidate's original Aadhaar in person (for those who couldn't use the QR or e-KYC check). */
export async function markAadhaarSeen(candidateId: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (profile.role === "branch") return { ok: false, message: "Only HR can record this." };
  const { error } = await supabase.rpc("mark_aadhaar_seen", { p_candidate: candidateId });
  if (error) return { ok: false, message: error.message };
  await supabase.from("candidate_events").insert({ candidate_id: candidateId, actor: profile.username, stage: "onboarding", remark: "Original Aadhaar seen in person" });
  revalidatePath("/dashboard");
  return { ok: true, message: "Recorded: original Aadhaar seen." };
}

/** Change the allocated branch after selection; the candidate moves to that branch's HR. */
export async function changeBranch(candidateId: string, branchId: string): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (profile.role === "branch") return { ok: false, message: "Only HR or an admin can change the branch." };
  const { data: c } = await supabase.from("candidates").select(CANDIDATE_COLUMNS).eq("id", candidateId).single<Candidate>();
  if (!c) return { ok: false, message: "Candidate not found." };
  if (c.branch_id === branchId) return { ok: false, message: "That is already the allocated branch." };
  const { data: b } = await supabase.from("branches").select("*").eq("id", branchId).single<Branch>();
  if (!b) return { ok: false, message: "Select a branch." };
  await supabase.from("candidate_events").insert({
    candidate_id: c.id, actor: profile.username, stage: "branch", from_status: c.pipeline_status, to_status: c.pipeline_status,
    details: { from_branch: c.branch_id, to_branch: b.id, transferred_to: b.hr_username }, remark: `Branch changed to ${b.name}`,
  });
  const { error } = await supabase.rpc("transfer_candidate", { p_candidate: c.id, p_branch: b.id });
  if (error) return { ok: false, message: error.message };
  if (b.hr_username !== profile.username && b.hr_username !== c.assigned_hr) {
    const text = `${c.name} (${c.mobile}) has been moved to you: branch changed to ${b.name}.`;
    await supabase.from("notifications").insert({ sender: profile.username, recipient: b.hr_username, message: text });
    await pushTo(b.hr_username, { title: "Candidate moved to you", body: text, url: "/dashboard" });
  }
  revalidatePath("/dashboard");
  return { ok: true, message: b.hr_username === c.assigned_hr ? `Branch changed to ${b.name}.` : `Branch changed to ${b.name}; moved to ${b.hr_username}.` };
}

/** Logged when HR taps WhatsApp or SMS in Today's SMS List, so the row drops off for that item. */
export async function markSmsSent(candidateId: string, key: string, label: string, channel: "whatsapp" | "sms"): Promise<Result> {
  const { profile, supabase } = await requireProfile();
  if (profile.role === "branch") return { ok: false, message: "Not allowed." };
  const { error } = await supabase.from("candidates").update({ last_sms_key: key.slice(0, 200), last_sms_at: new Date().toISOString() }).eq("id", candidateId);
  if (error) return { ok: false, message: error.message };
  await supabase.from("candidate_events").insert({ candidate_id: candidateId, actor: profile.username, stage: "sms", remark: `${channel === "sms" ? "SMS" : "WhatsApp"} opened: ${label}` });
  revalidatePath("/dashboard");
  return { ok: true, message: "Marked as sent." };
}

/** The store asks an admin to allow a walk-in for a blocked person. */
export async function requestWalkinApproval(input: WalkinInput): Promise<Result> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("request_walkin_override", { p_mobile: input.mobile, p_branch: input.branchId, p_payload: input });
  if (error) return { ok: false, message: error.message };
  const messages: Record<string, string> = {
    ok: "Sent to admin for approval. You'll get a notification when they decide.",
    already: "An approval request for this person is already waiting with the admin.",
    not_blocked: "This person isn't blocked; save the walk-in normally.",
    not_found: "No record for this mobile; save the walk-in normally.",
    bad_branch: "Select a branch.",
  };
  return { ok: data === "ok" || data === "already", message: messages[data as string] ?? "Could not send the request." } as Result;
}
