import type { Candidate } from "./types";
import { isBlacklisted, needsReapplyReview, stageFor } from "./pipeline";

/** Languages HR can tick on a talent pool person. Roles and stores come from the portal's own lists. */
export const TALENT_LANGUAGES = ["Tamil", "English", "Hindi", "Telugu", "Malayalam", "Kannada"];

type PoolFields = Pick<Candidate, "pipeline_status" | "rejection_reason" | "reapply_review" | "talent_pool" | "interview_status">;

/** Why this person can't go in the pool, or null if they can. Same rules as candidates_talent() in the database. */
export function talentBlock(c: PoolFields): string | null {
  if (c.pipeline_status === "Joined") return "Working here now, so not in the talent pool.";
  if (isBlacklisted(c)) return "Not Suitable or over-age, so they can't go in the talent pool.";
  return null;
}

/** Why HR can't call this pool person back for a new opening, or null if they can (talent_call_back() in the database). */
export function callBackBlock(c: PoolFields & Pick<Candidate, "assigned_hr">): string | null {
  if (!c.talent_pool) return "Not in the talent pool.";
  const block = talentBlock(c);
  if (block) return block;
  if (c.reapply_review || needsReapplyReview(c)) return "Underage, absconded or rejected at screening: an admin decides from the Re-Apply folder.";
  if (stageFor(c as Candidate) !== "closed") return `Already in follow-up with ${c.assigned_hr}.`;
  return null;
}

/** A closed candidate worth keeping: why the portal suggests the talent pool, or null. */
export function talentSuggestion(c: PoolFields, scores: { recommendation: string }[] = []): string | null {
  if (c.talent_pool || talentBlock(c) || c.reapply_review || needsReapplyReview(c)) return null;
  if (stageFor(c as Candidate) !== "closed") return null;
  const s = c.pipeline_status ?? "";
  if (s === "Selected Candidate Dropped") return "Was selected but didn't join.";
  if (c.interview_status === "Selected" || c.interview_status === "Hold") return `Interview result was ${c.interview_status}.`;
  if (scores.some((x) => x.recommendation === "hire" || x.recommendation === "hold")) return "Interview scorecard said Hire or Hold.";
  if (s.startsWith("Left") && s.includes("With Information")) return "Worked here and left on good terms.";
  return null;
}

/** Keep only tags from the fixed lists, in the order given, without repeats. */
export function cleanTalentTags(tags: string[], allowed: string[]): string[] {
  const ok = new Set(allowed);
  return [...new Set(tags.map((t) => t.trim()).filter((t) => ok.has(t)))].slice(0, 20);
}

/** Empty candidate fields, so another HR's talent pool person (basics only) fits the dashboard's list. */
const BLANK: Omit<Candidate, "id" | "name" | "mobile"> = {
  source: "online", marital_status: null, father_name: null, email: null, address: null, posts: [], applied_locations: [],
  branch_id: null, assigned_hr: "", entry_by: null, received_at: "", pipeline_status: "", next_action: null, next_action_at: null,
  calling_status: null, calling_action: null, first_call_at: null, first_retry_status: null, first_retry_at: null,
  second_retry_status: null, second_retry_at: null, third_retry_status: null, third_retry_at: null, interview_at: null,
  interview_attendance: null, interview_status: null, not_attended_reason: null, reschedule_at: null, reschedule_attendance: null,
  reminder_status: null, reminder_at: null, designation: null, basic_salary: 0, allowances: 0, expected_joining_date: null,
  joining_status: null, not_joined_reason: null, revised_joining_date: null, revised_joining_status: null, actual_joining_date: null,
  employment_status: null, left_type: null, relieving_date: null, rejection_reason: null, interview_needed: null, details_submitted_at: null,
  source_channel: null, referred_by: null, talent_pool: true, talent_tags: [], offer_response: null, offer_responded_at: null,
  offer_decline_reason: null, confirmation_date: null, confirmation_approved_by: null, confirmation_approved_at: null, last_sms_key: null,
  last_sms_at: null, employee_code: null, shift_time: null, store_details_at: null, payroll_completed_at: null, payroll_completed_by: null,
  reapply_review: false, reapply_at: null, proposed_basic: null, proposed_allowances: null, salary_status: null, salary_approved_by: null,
  salary_approved_at: null, aadhaar_check: null, created_at: "", updated_at: "",
};

export function poolOnlyCandidate(o: Partial<Candidate>): Candidate {
  const picked = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
  return { ...BLANK, id: "", name: "", mobile: "", ...picked, talent_pool: true } as Candidate;
}
