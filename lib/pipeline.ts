/**
 * The recruitment pipeline, ported from update_status() in the original app.py
 * and the stage picker in dashboard.html. Pure functions: no database access,
 * so the rules can be unit tested.
 */
import type { Candidate } from "./types";
import { dateToIso, localInputToIso, nowIso, tomorrowIstIso } from "./dates";

export type Stage =
  | "initial"
  | "first_retry"
  | "second_retry"
  | "third_retry"
  | "interview"
  | "interview_rescheduled"
  | "interview_reminder"
  | "joining"
  | "revised_joining"
  | "employment"
  | "closed";

export const STAGE_TITLES: Record<Stage, string> = {
  initial: "Stage 1: Initial screening call",
  first_retry: "Stage 2: First retry",
  second_retry: "Stage 3: Second retry",
  third_retry: "Stage 4: Third retry",
  interview: "Post-interview assessment",
  interview_rescheduled: "Rescheduled interview assessment",
  interview_reminder: "Interview unreachable reminder",
  joining: "Joining status",
  revised_joining: "Revised joining status",
  employment: "Employee working status",
  closed: "Closed",
};

export const CALL_OUTCOMES = ["Contacted", "Not Reachable", "Switch Off", "Ringing Not Response", "Busy / Cut Call", "Wrong Number"];
export const SCREENING_REJECTION_REASONS = ["Salary Expectation High", "Timing Preference", "Not Suitable", "Age Criteria", "Distance Issue", "Not Interested"];
export const REPORT_REASONS = ["Not Suitable", "Age Criteria", "Salary Expectation High", "Distance Issue", "Not Interested", "Wrong Number", "Not Contactable", "Joined & Left"];

const TERMINAL_STATUSES = [
  "Wrong Number", "Not Contactable", "Scheduled Not Contactable", "Interview Scheduled - No Response",
  "Screening Rejected", "Not Selected - Not Suitable", "Interview Not Selected - Dropped by Candidate",
  "Interview Rescheduled Not Attended", "Selected Candidate Dropped",
];

export function isBlacklisted(c: Pick<Candidate, "pipeline_status" | "rejection_reason">): boolean {
  const r = c.rejection_reason ?? "";
  const s = c.pipeline_status ?? "";
  return r.includes("Not Suitable") || r.includes("Age Criteria") || s.startsWith("Screening Rejected")
    || (s.startsWith("Left") && s.includes("Without Information"));
}

/** Which update form a candidate gets, based on where they are. */
export function stageFor(c: Candidate): Stage {
  const s = c.pipeline_status || "Follow-up Not Started";
  if (s === "Joined") return "employment";
  if (s.startsWith("Left") || TERMINAL_STATUSES.includes(s) || s.startsWith("Screening Rejected")) return "closed";
  if (s === "Selected / Offer Generated" || s === "Expected Joining") return "joining";
  if (s === "Revised Joining") return "revised_joining";
  if (s === "Interview Scheduled - Unreachable") return "interview_reminder";
  if (s.startsWith("Interview Rescheduled")) return "interview_rescheduled";
  if (s === "Interview Scheduled" || s === "Waiting for Admin Approval" || s.includes("Hold")) return "interview";
  if (c.second_retry_status) return "third_retry";
  if (c.first_retry_status) return "second_retry";
  if ((c.calling_status && c.calling_status !== "Contacted") || s === "Follow-up Unreachable") return "first_retry";
  return "initial";
}

/** Everything a pipeline form can send. Only the fields for the current stage are read. */
export interface StageInput {
  callOutcome?: string;           // screening stages
  callAction?: "Interview Scheduled" | "Rejected" | "";
  interviewAt?: string;           // datetime-local
  rejectionReason?: string;

  attendance?: "Attended" | "Not Attended" | "";
  interviewStatus?: "Selected" | "Not Selected" | "Hold" | "";
  notSelectedReason?: "Not Suitable" | "Dropped by Candidate" | "";
  notAttendedReason?: "No Response" | "Interview Rescheduled" | "Unreachable" | "Not Interested" | "";
  rescheduleAt?: string;          // datetime-local
  reminderStatus?: "Interview Rescheduled" | "Unreachable" | "";

  basicSalary?: string;
  allowances?: string;
  branchId?: string;
  designation?: string;
  expectedJoiningDate?: string;   // yyyy-mm-dd

  joiningStatus?: "Joined" | "Not Joined" | "";
  notJoinedReason?: "Revised Joining" | "Candidate Dropped" | "";
  revisedJoiningDate?: string;
  revisedJoiningStatus?: "Joined" | "Not Joined" | "";
  actualJoiningDate?: string;

  employmentStatus?: "Working" | "Left" | "";
  leftType?: "With Information" | "Without Information";
  relievingDate?: string;

  remark?: string;
}

export interface NotificationDraft {
  recipient: "hr" | "branch";
  message: string;
}

export interface StageResult {
  patch: Partial<Candidate>;
  notify: NotificationDraft[];
  error?: string;
}

const num = (v?: string) => (v && v.trim() ? Number(v) : 0);

function selectedPatch(input: StageInput): Partial<Candidate> | string {
  if (!input.expectedJoiningDate) return "Expected joining date is required.";
  if (!input.branchId) return "Branch allocated is required.";
  return {
    pipeline_status: "Expected Joining",
    interview_status: "Selected",
    basic_salary: num(input.basicSalary),
    allowances: num(input.allowances),
    branch_id: input.branchId,
    designation: input.designation?.trim() || null,
    expected_joining_date: input.expectedJoiningDate,
    next_action: `Check joining status (${input.expectedJoiningDate})`,
    next_action_at: dateToIso(input.expectedJoiningDate),
  };
}

function rejected(status: string, reason: string, nextAction: string): Partial<Candidate> {
  return { pipeline_status: status, rejection_reason: reason, next_action: nextAction, next_action_at: null };
}

export function applyStage(c: Candidate, stage: Stage, input: StageInput, now: Date = new Date()): StageResult {
  const at = now.toISOString();
  const tomorrow = tomorrowIstIso(now);
  const notify: NotificationDraft[] = [];
  let patch: Partial<Candidate> = {};
  const fail = (error: string): StageResult => ({ patch: {}, notify: [], error });

  switch (stage) {
    case "initial":
    case "first_retry":
    case "second_retry":
    case "third_retry": {
      const outcome = input.callOutcome?.trim();
      if (!outcome) return fail("Select the call outcome.");
      const col = {
        initial: ["calling_status", "first_call_at"],
        first_retry: ["first_retry_status", "first_retry_at"],
        second_retry: ["second_retry_status", "second_retry_at"],
        third_retry: ["third_retry_status", "third_retry_at"],
      }[stage] as [keyof Candidate, keyof Candidate];
      patch = { [col[0]]: outcome, [col[1]]: at } as Partial<Candidate>;

      if (outcome === "Contacted") {
        if (input.callAction === "Interview Scheduled") {
          const interviewAt = localInputToIso(input.interviewAt);
          if (!interviewAt) return fail("Enter the interview date and time.");
          Object.assign(patch, {
            calling_action: "Interview Scheduled",
            pipeline_status: "Interview Scheduled",
            interview_at: interviewAt,
            next_action: "Check interview attendance",
            next_action_at: interviewAt,
          });
          notify.push({ recipient: "branch", message: `Interview scheduled: ${c.name} on {interview_at}.` });
        } else if (input.callAction === "Rejected") {
          if (!input.rejectionReason) return fail("Select a rejection reason.");
          Object.assign(patch, { calling_action: "Rejected" }, rejected("Screening Rejected", input.rejectionReason, "Screening rejected"));
        } else {
          return fail("Choose Interview Scheduled or Rejected.");
        }
      } else if (outcome === "Wrong Number") {
        Object.assign(patch, rejected("Wrong Number", "Wrong Number", "Wrong number"));
      } else {
        const next = { initial: ["Follow-up Unreachable", "First retry"], first_retry: ["First Retry Unreachable", "Second retry"], second_retry: ["Second Retry Unreachable", "Third retry"] } as const;
        if (stage === "third_retry") {
          Object.assign(patch, rejected("Not Contactable", "Not Contactable", "Not contactable"));
        } else {
          Object.assign(patch, { pipeline_status: next[stage][0], next_action: next[stage][1], next_action_at: tomorrow });
        }
      }
      break;
    }

    case "interview":
    case "interview_rescheduled": {
      const attendance = input.attendance;
      if (!attendance) return fail("Select interview attendance.");
      patch = stage === "interview" ? { interview_attendance: attendance } : { reschedule_attendance: attendance };

      if (attendance === "Attended") {
        const st = input.interviewStatus;
        if (st === "Selected") {
          const p = selectedPatch(input);
          if (typeof p === "string") return fail(p);
          Object.assign(patch, p);
        } else if (st === "Not Selected") {
          if (input.notSelectedReason === "Not Suitable") {
            Object.assign(patch, { interview_status: st }, rejected("Not Selected - Not Suitable", "Not Suitable", "Screening rejected"));
          } else {
            Object.assign(patch, { interview_status: st }, rejected("Interview Not Selected - Dropped by Candidate", stage === "interview" ? "Dropped by Candidate" : "Candidate Dropped", "Candidate dropped"));
          }
        } else if (st === "Hold") {
          Object.assign(patch, { interview_status: "Hold", pipeline_status: "Waiting for Admin Approval", rejection_reason: "Hold", next_action: "Waiting for admin approval", next_action_at: null });
        } else {
          return fail("Select the interview result.");
        }
      } else if (stage === "interview_rescheduled") {
        Object.assign(patch, rejected("Selected Candidate Dropped", "Interview Rescheduled Candidate Dropped", "Candidate dropped"));
      } else {
        const reason = input.notAttendedReason;
        if (!reason) return fail("Select why they did not attend.");
        patch.not_attended_reason = reason;
        if (reason === "No Response") {
          Object.assign(patch, rejected("Interview Scheduled - No Response", "Not Contactable", "Not contactable"));
        } else if (reason === "Interview Rescheduled") {
          const r = localInputToIso(input.rescheduleAt);
          if (!r) return fail("Enter the new interview date and time.");
          Object.assign(patch, { pipeline_status: "Interview Rescheduled", reschedule_at: r, interview_at: r, reminder_at: at, next_action: "Rescheduled attendance check", next_action_at: r });
        } else if (reason === "Unreachable") {
          Object.assign(patch, { pipeline_status: "Interview Scheduled - Unreachable", next_action: "Interview absent re-follow-up", next_action_at: tomorrow });
        } else {
          Object.assign(patch, rejected("Interview Not Selected - Dropped by Candidate", "Candidate Dropped", "Candidate dropped"));
        }
      }
      break;
    }

    case "interview_reminder": {
      const rs = input.reminderStatus;
      if (!rs) return fail("Select the reminder outcome.");
      patch = { reminder_status: rs, reminder_at: at };
      if (rs === "Interview Rescheduled") {
        const r = localInputToIso(input.rescheduleAt);
        if (!r) return fail("Enter the new interview date and time.");
        Object.assign(patch, { pipeline_status: "Interview Rescheduled", reschedule_at: r, interview_at: r, next_action: "Rescheduled attendance check", next_action_at: r });
      } else {
        Object.assign(patch, rejected("Selected Candidate Dropped", "Interview Scheduled Unreachable Candidate Dropped", "Candidate dropped"));
      }
      break;
    }

    case "joining": {
      const js = input.joiningStatus;
      if (!js) return fail("Select joining status.");
      patch = { joining_status: js };
      if (js === "Joined") {
        if (!input.actualJoiningDate) return fail("Enter the actual joining date.");
        Object.assign(patch, {
          pipeline_status: "Joined", actual_joining_date: input.actualJoiningDate, employment_status: "Working",
          basic_salary: input.basicSalary ? num(input.basicSalary) : c.basic_salary,
          allowances: input.allowances ? num(input.allowances) : c.allowances,
          next_action: "Joined successfully", next_action_at: null,
        });
        notify.push({ recipient: "branch", message: `New employee joined: ${c.name}. Please assign employee code and shift timing.` });
      } else if (input.notJoinedReason === "Revised Joining") {
        if (!input.revisedJoiningDate) return fail("Enter the revised joining date.");
        Object.assign(patch, { not_joined_reason: "Revised Joining", pipeline_status: "Revised Joining", revised_joining_date: input.revisedJoiningDate, next_action: `Check revised joining (${input.revisedJoiningDate})`, next_action_at: dateToIso(input.revisedJoiningDate) });
      } else if (input.notJoinedReason === "Candidate Dropped") {
        Object.assign(patch, { not_joined_reason: "Candidate Dropped" }, rejected("Selected Candidate Dropped", "Candidate Dropped", "Candidate dropped"));
      } else {
        return fail("Select why they did not join.");
      }
      break;
    }

    case "revised_joining": {
      const rs = input.revisedJoiningStatus;
      if (!rs) return fail("Select revised joining status.");
      patch = { revised_joining_status: rs };
      if (rs === "Joined") {
        if (!input.actualJoiningDate) return fail("Enter the actual joining date.");
        Object.assign(patch, { pipeline_status: "Joined", joining_status: "Joined", actual_joining_date: input.actualJoiningDate, employment_status: "Working", next_action: "Joined successfully", next_action_at: null });
        notify.push({ recipient: "branch", message: `New employee joined: ${c.name}. Please assign employee code and shift timing.` });
      } else {
        Object.assign(patch, rejected("Selected Candidate Dropped", "Candidate Dropped", "Candidate dropped"));
      }
      break;
    }

    case "employment": {
      if (input.employmentStatus !== "Left") {
        patch = { employment_status: "Working" };
        break;
      }
      const leftType = input.leftType ?? "Without Information";
      const relieving = input.relievingDate || at.slice(0, 10);
      patch = {
        employment_status: "Left", left_type: leftType, relieving_date: relieving,
        pipeline_status: `Left (${leftType} on ${relieving})`,
        rejection_reason: `Joined & Left (${leftType})`,
        next_action: leftType === "Without Information" ? "Employment terminated (blacklisted)" : "Employment terminated (re-apply allowed)",
        next_action_at: null,
      };
      break;
    }

    case "closed":
      return fail("This candidate is closed. Reactivate them first.");
  }

  return { patch, notify };
}

/** Reactivate a dropped / unreachable candidate (fixed version of reactivate_candidate()). */
export function reactivate(c: Candidate, now: Date = new Date()): StageResult {
  if (isBlacklisted(c)) return { patch: {}, notify: [], error: "Permanently rejected or absconding candidates cannot be reactivated." };
  const s = c.pipeline_status;
  const tomorrow = tomorrowIstIso(now);
  let patch: Partial<Candidate>;
  if (s.includes("Interview") || s.includes("Unreachable") || s.includes("No Response")) {
    patch = { pipeline_status: "Interview Rescheduled", next_action: "Rescheduled attendance check", next_action_at: c.interview_at ?? tomorrow };
  } else if (s.includes("Dropped") || s.includes("Joining")) {
    patch = { pipeline_status: "Revised Joining", next_action: "Check revised joining", next_action_at: tomorrow };
  } else {
    patch = { pipeline_status: "Follow-up Unreachable", next_action: "First retry", next_action_at: tomorrow, first_retry_status: null, second_retry_status: null, third_retry_status: null };
  }
  return { patch: { ...patch, rejection_reason: null }, notify: [] };
}

export { nowIso };
