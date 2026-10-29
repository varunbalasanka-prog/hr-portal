"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { pushTo } from "@/lib/push";
import { localInputToIso, tomorrowIstIso } from "@/lib/dates";
import type { Branch } from "@/lib/types";
import { cleanWarnAge } from "@/lib/walkin";
import { dobRule } from "@/lib/walkin-server";
import type { WalkinInput } from "./candidates";

type Result = { ok: boolean; message: string };

async function tell(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], sender: string, to: string, title: string, text: string) {
  await supabase.from("notifications").insert({ sender, recipient: to, message: text });
  await pushTo(to, { title, body: text, url: "/dashboard" });
}

/** Re-Apply folder: the admin lets HR call this person again. They start over with the HR of the store they last applied to;
 *  the old record is kept in their history. */
export async function releaseReapply(candidateId: string): Promise<Result> {
  const { profile, supabase } = await requireAdmin();
  const { data: c } = await supabase.from("candidates").select("id, name, mobile, applied_locations, assigned_hr").eq("id", candidateId)
    .single<{ id: string; name: string; mobile: string; applied_locations: string[]; assigned_hr: string }>();
  if (!c) return { ok: false, message: "Candidate not found." };
  const { data: app } = await supabase.from("applications").select("branch_id").eq("candidate_id", c.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle<{ branch_id: string | null }>();
  const { data: b } = app?.branch_id
    ? await supabase.from("branches").select("*").eq("id", app.branch_id).single<Branch>()
    : await supabase.from("branches").select("*").eq("name", c.applied_locations.at(-1) ?? "").maybeSingle<Branch>();
  const hr = b?.hr_username ?? c.assigned_hr;
  const { error } = await supabase.rpc("restart_candidate", {
    p_candidate: c.id, p_remark: "Enabled for HR calling from the Re-Apply folder",
    p_patch: { pipeline_status: "Follow-up Not Started", assigned_hr: hr, next_action: "Follow-up start immediately" },
  });
  if (error) return { ok: false, message: error.message };
  await tell(supabase, profile.username, hr, "Re-applicant enabled", `${c.name} (${c.mobile}) re-applied and has been enabled for calling by ${profile.username}. Check their history before calling.`);
  revalidatePath("/dashboard");
  return { ok: true, message: `Enabled for calling; sent to ${hr}.` };
}

export async function dismissReapply(candidateId: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("dismiss_reapply", { p_candidate: candidateId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Kept closed and removed from the Re-Apply folder." };
}

export async function sendToReapply(candidateId: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("send_to_reapply", { p_candidate: candidateId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Moved to the Re-Apply folder." };
}

/** Above this age the walk-in form warns the store (it can still save) and tells HR. Blank switches the warning off (saved as 0). */
export async function saveWalkinWarnAge(raw: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const age = cleanWarnAge(raw);
  if (age === undefined) return { ok: false, message: "Enter a whole number from 18 to 80, or leave it blank for no warning." };
  const { error } = await supabase.from("app_settings").upsert({ key: "walkin_warn_age", value: age ?? 0, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true, message: age ? `Saved. Stores are warned when a walk-in is older than ${age}.` : "Saved. No age warning on walk-ins." };
}

/** Admin decides a store's request to add a blocked person as a walk-in. Approving starts them over as a walk-in at that store. */
export async function decideWalkin(requestId: string, approve: boolean): Promise<Result> {
  const { profile, supabase } = await requireAdmin();
  const { data: r } = await supabase.from("walkin_requests").select("*").eq("id", requestId).eq("status", "pending")
    .single<{ id: string; candidate_id: string; branch_id: string; payload: WalkinInput; requested_by: string }>();
  if (!r) return { ok: false, message: "Request not found or already decided." };
  const { data: c } = await supabase.from("candidates").select("id, name, mobile").eq("id", r.candidate_id).single<{ id: string; name: string; mobile: string }>();
  const { data: b } = await supabase.from("branches").select("*").eq("id", r.branch_id).single<Branch>();
  if (!c || !b) return { ok: false, message: "Candidate or branch no longer exists." };

  if (approve) {
    const p = r.payload;
    // Every walk-in goes to an interview (older requests may still say "direct joining"; they get one too).
    const interviewAt = localInputToIso(p.interviewAt) ?? tomorrowIstIso();
    const { error } = await supabase.rpc("restart_candidate", {
      p_candidate: c.id, p_remark: `Walk-in at ${b.name} approved by ${profile.username} (requested by ${r.requested_by})${p.remark ? `: ${p.remark}` : ""}`,
      p_patch: {
        source: "walkin", entry_by: r.requested_by, post: p.post, branch_name: b.name, branch_id: "",
        assigned_hr: b.hr_username, interview_needed: true, interview_at: interviewAt,
        expected_joining_date: null, designation: null,
        pipeline_status: "Interview Scheduled",
        next_action: "Check interview attendance",
        next_action_at: interviewAt,
      },
    });
    if (error) return { ok: false, message: error.message };
    // Keep the date of birth the store typed, under the apply page's label.
    if (p.dateOfBirth) {
      const [{ data: row }, rule] = await Promise.all([
        supabase.from("candidates").select("form_data").eq("id", c.id).single<{ form_data: Record<string, string> | null }>(),
        dobRule(supabase),
      ]);
      await supabase.from("candidates").update({ form_data: { ...(row?.form_data ?? {}), [rule.label]: p.dateOfBirth } }).eq("id", c.id);
    }
  }
  const { error } = await supabase.from("walkin_requests").update({ status: approve ? "approved" : "refused", decided_by: profile.username, decided_at: new Date().toISOString() }).eq("id", r.id);
  if (error) return { ok: false, message: error.message };
  const verdict = `Walk-in for ${c.name} (${c.mobile}) at ${b.name} was ${approve ? "APPROVED" : "refused"} by ${profile.username}.`;
  await tell(supabase, profile.username, r.requested_by, "Walk-in decision", verdict);
  if (approve && b.hr_username !== r.requested_by) await tell(supabase, profile.username, b.hr_username, "New walk-in (approved)", verdict);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true, message: approve ? "Approved; the walk-in is created." : "Refused; the store has been told." };
}
