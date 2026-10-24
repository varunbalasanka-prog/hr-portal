/** Dashboard lists and counts, ported from get_sheet_data() in the original app.py. */
import type { Candidate, OnboardingSubmission } from "./types";
import { isBlacklisted } from "./pipeline";
import { isoToIstDate, todayIst } from "./dates";

export type Category =
  | "received" | "not_contacted" | "interview_scheduled" | "selected_joined"
  | "online_joined_list" | "walkin_joined_list"
  | "screening_rejected" | "wrong_number" | "not_contactable" | "candidate_dropped" | "dropped_rejected" | "joined_left"
  | "store_details_pending" | "payroll_pending" | "reapply";

export type Tone = "slate" | "sky" | "indigo" | "green" | "amber" | "red" | "zinc" | "purple";

export interface Categorized {
  category: Category;
  label: string;
  tone: Tone;
  active: boolean;
  docCategory: string; // onboarding list key, or "none"
}

const hasJoined = (c: Candidate) => c.pipeline_status === "Joined" && !!c.actual_joining_date;
/** Joined, and HR has finished payroll: only then is the person on the official Completed list. */
const isJoinedComplete = (c: Candidate) => hasJoined(c) && !!c.payroll_completed_at;

export function categorize(c: Candidate, onboarding?: OnboardingSubmission | null): Categorized {
  let s = c.pipeline_status || "Follow-up Not Started";
  if (isBlacklisted(c) && !s.startsWith("Screening Rejected") && !s.includes("Left") && !s.startsWith("Not Selected")) s = "Screening Rejected";

  let r: Omit<Categorized, "docCategory">;
  const walkin = c.source === "walkin";

  if (c.reapply_review) {
    r = { category: "reapply", label: `Re-Apply review (${c.rejection_reason || c.pipeline_status})`, tone: "purple", active: false };
  } else if (s === "Joined") {
    r = isJoinedComplete(c)
      ? { category: walkin ? "walkin_joined_list" : "online_joined_list", label: walkin ? "Walk-in Joined" : "Online Joined", tone: "green", active: false }
      : !hasJoined(c)
        ? { category: "received", label: "Documents verified (joining date pending)", tone: "amber", active: true }
        : c.store_details_at
          ? { category: "payroll_pending", label: "Payroll completion pending", tone: "indigo", active: false }
          : { category: "store_details_pending", label: "Waiting for store: employee code & shift", tone: "amber", active: false };
  } else if (s.startsWith("Left")) {
    r = { category: "joined_left", label: s, tone: "zinc", active: false };
  } else if (s === "Wrong Number" || c.rejection_reason === "Wrong Number") {
    r = { category: "wrong_number", label: "Wrong Number", tone: "zinc", active: false };
  } else if (["Not Contactable", "Scheduled Not Contactable", "Interview Scheduled - No Response", "Interview Rescheduled Not Attended"].includes(s)) {
    r = { category: "not_contactable", label: s, tone: "zinc", active: false };
  } else if (["Screening Rejected", "Not Selected - Not Suitable", "Interview Not Selected - Dropped by Candidate"].includes(s)) {
    r = { category: "screening_rejected", label: c.rejection_reason ? `${s} (${c.rejection_reason})` : s, tone: "red", active: false };
  } else if (s === "Selected Candidate Dropped") {
    r = { category: "candidate_dropped", label: "Candidate Dropped", tone: "amber", active: false };
  } else if (["Interview Scheduled", "Interview Rescheduled", "Interview Scheduled - Unreachable", "Revised Joining", "Waiting for Admin Approval"].includes(s)) {
    r = { category: "interview_scheduled", label: s, tone: s === "Revised Joining" ? "indigo" : "sky", active: true };
  } else if (s === "Selected / Offer Generated" || s === "Expected Joining") {
    r = { category: "selected_joined", label: s, tone: "green", active: true };
  } else if (["Follow-up Unreachable", "First Retry Unreachable", "Second Retry Unreachable", "Third Retry Unreachable"].includes(s)) {
    r = { category: "not_contacted", label: s, tone: "amber", active: true };
  } else {
    r = { category: "received", label: "Follow-up Not Started", tone: "slate", active: true };
  }

  // Onboarding document lists (only for selected / joined candidates)
  let docCategory = "none";
  if (r.category !== "reapply" && (r.category === "selected_joined" || s === "Joined")) {
    const prefix = hasJoined(c) ? "joined_" : "not_joined_";
    if (!onboarding) docCategory = prefix + "docs_not_submitted";
    else if (onboarding.status === "pending") docCategory = prefix + "docs_pending";
    else docCategory = prefix + "docs_received";
  }
  return { ...r, docCategory };
}

export const DROPPED_CATEGORIES: Category[] = ["screening_rejected", "wrong_number", "not_contactable", "candidate_dropped", "dropped_rejected", "joined_left"];
export const COMPLETED_CATEGORIES: Category[] = ["online_joined_list", "walkin_joined_list"];
/** Joined, waiting for the store's details or HR's payroll step. */
export const ONBOARDING_CATEGORIES: Category[] = ["store_details_pending", "payroll_pending"];

export type Counts = Record<Category | "in_followup" | "completed" | "rejected" | "onboarding" | "left_with" | "left_without" | "total", number>;

export function countAll(items: Categorized[]): Counts {
  const counts = {
    received: 0, not_contacted: 0, interview_scheduled: 0, selected_joined: 0, online_joined_list: 0, walkin_joined_list: 0,
    screening_rejected: 0, wrong_number: 0, not_contactable: 0, candidate_dropped: 0, dropped_rejected: 0, joined_left: 0,
    store_details_pending: 0, payroll_pending: 0, reapply: 0,
    in_followup: 0, completed: 0, rejected: 0, onboarding: 0, left_with: 0, left_without: 0, total: 0,
  } as Counts;
  for (const it of items) {
    counts.total++;
    counts[it.category]++;
    if (it.category === "joined_left") counts[it.label.includes("Without Information") ? "left_without" : "left_with"]++;
    if (it.active) counts.in_followup++;
    else if (COMPLETED_CATEGORIES.includes(it.category)) counts.completed++;
    else if (ONBOARDING_CATEGORIES.includes(it.category)) counts.onboarding++;
    else if (it.category !== "reapply") counts.rejected++;
  }
  return counts;
}

/** "Today's Work": next action falls today (IST) or is overdue while still active, plus tomorrow's interviews and
 *  joinings (so the day-before reminder is done in time). */
export function isTodaysWork(c: Candidate, cat: Categorized, now: Date = new Date()): boolean {
  if (!cat.active) return false;
  if (needsTomorrowReminder(c, cat, now)) return true;
  const d = isoToIstDate(c.next_action_at);
  if (!d) return cat.category === "received" && c.pipeline_status === "Follow-up Not Started";
  return d <= todayIst(now);
}

/** Reminder list: interview or joining happening tomorrow. */
export function needsTomorrowReminder(c: Candidate, cat: Categorized, now: Date = new Date()): boolean {
  if (!cat.active || !["interview_scheduled", "selected_joined"].includes(cat.category)) return false;
  const d = isoToIstDate(c.next_action_at);
  const tomorrow = todayIst(new Date(now.getTime() + 86400000));
  return d === tomorrow;
}
