import { describe, expect, it } from "vitest";
import { applyStage, isBlacklisted, reactivate, stageFor } from "../lib/pipeline";
import { categorize, countAll } from "../lib/categorize";
import { calculateSalary } from "../lib/salary";
import { probationEnd, localInputToIso } from "../lib/dates";
import type { Candidate } from "../lib/types";

const base: Candidate = {
  id: "c1", source: "online", name: "Priya", mobile: "9000000001", marital_status: null, father_name: null, email: null, address: null,
  posts: ["Sales"], applied_locations: ["Tanishq - Theni"], branch_id: null, assigned_hr: "lithiga", entry_by: null,
  received_at: "2026-10-20T00:00:00Z", pipeline_status: "Follow-up Not Started", next_action: null, next_action_at: null,
  calling_status: null, calling_action: null, first_call_at: null, first_retry_status: null, first_retry_at: null,
  second_retry_status: null, second_retry_at: null, third_retry_status: null, third_retry_at: null, interview_at: null,
  interview_attendance: null, interview_status: null, not_attended_reason: null, reschedule_at: null, reschedule_attendance: null,
  reminder_status: null, reminder_at: null, designation: null, basic_salary: 0, allowances: 0, expected_joining_date: null,
  joining_status: null, not_joined_reason: null, revised_joining_date: null, revised_joining_status: null, actual_joining_date: null,
  employment_status: null, left_type: null, relieving_date: null, rejection_reason: null, interview_needed: null, form_data: {},
  access_token: "t", created_at: "", updated_at: "",
};
const now = new Date("2026-10-24T06:00:00Z");
const run = (c: Candidate, input: Parameters<typeof applyStage>[2]) => {
  const r = applyStage(c, stageFor(c), input, now);
  expect(r.error).toBeUndefined();
  return { ...c, ...r.patch } as Candidate;
};

describe("screening calls", () => {
  it("walks three unreachable retries to Not Contactable", () => {
    let c = run(base, { callOutcome: "Switch Off" });
    expect(c.pipeline_status).toBe("Follow-up Unreachable");
    expect(stageFor(c)).toBe("first_retry");
    c = run(c, { callOutcome: "Busy / Cut Call" });
    expect(c.pipeline_status).toBe("First Retry Unreachable");
    c = run(c, { callOutcome: "Not Reachable" });
    expect(c.pipeline_status).toBe("Second Retry Unreachable");
    expect(stageFor(c)).toBe("third_retry");
    c = run(c, { callOutcome: "Switch Off" });
    expect(c.pipeline_status).toBe("Not Contactable");
    expect(stageFor(c)).toBe("closed");
  });

  it("schedules an interview and notifies the branch", () => {
    const r = applyStage(base, "initial", { callOutcome: "Contacted", callAction: "Interview Scheduled", interviewAt: "2026-10-25T10:30" }, now);
    expect(r.patch.pipeline_status).toBe("Interview Scheduled");
    expect(r.patch.interview_at).toBe("2026-10-25T05:00:00.000Z");
    expect(r.notify).toHaveLength(1);
  });

  it("blacklists Not Suitable / Age Criteria rejections", () => {
    const c = run(base, { callOutcome: "Contacted", callAction: "Rejected", rejectionReason: "Age Criteria" });
    expect(isBlacklisted(c)).toBe(true);
    expect(reactivate(c).error).toBeDefined();
  });
});

describe("interview to joining", () => {
  const scheduled = { ...base, pipeline_status: "Interview Scheduled", calling_status: "Contacted" };
  it("selection needs a joining date and branch", () => {
    expect(applyStage(scheduled, "interview", { attendance: "Attended", interviewStatus: "Selected" }, now).error).toBeDefined();
    const c = run(scheduled, { attendance: "Attended", interviewStatus: "Selected", expectedJoiningDate: "2026-11-01", branchId: "b1", basicSalary: "12000", allowances: "2000" });
    expect(c.pipeline_status).toBe("Expected Joining");
    expect(stageFor(c)).toBe("joining");
    const joined = run(c, { joiningStatus: "Joined", actualJoiningDate: "2026-11-01" });
    expect(joined.pipeline_status).toBe("Joined");
    expect(categorize(joined).category).toBe("online_joined_list");
    const left = run(joined, { employmentStatus: "Left", leftType: "Without Information", relievingDate: "2027-01-10" });
    expect(left.pipeline_status).toBe("Left (Without Information on 2027-01-10)");
    expect(isBlacklisted(left)).toBe(true);
  });

  it("reschedules and drops on second no-show", () => {
    let c = run(scheduled, { attendance: "Not Attended", notAttendedReason: "Interview Rescheduled", rescheduleAt: "2026-10-27T11:00" });
    expect(stageFor(c)).toBe("interview_rescheduled");
    c = run(c, { attendance: "Not Attended" });
    expect(c.pipeline_status).toBe("Selected Candidate Dropped");
    expect(reactivate(c).patch.pipeline_status).toBe("Revised Joining");
  });

  it("revised joining", () => {
    const sel = { ...base, pipeline_status: "Expected Joining", expected_joining_date: "2026-11-01" };
    const c = run(sel, { joiningStatus: "Not Joined", notJoinedReason: "Revised Joining", revisedJoiningDate: "2026-11-05" });
    expect(stageFor(c)).toBe("revised_joining");
    expect(run(c, { revisedJoiningStatus: "Joined", actualJoiningDate: "2026-11-05" }).pipeline_status).toBe("Joined");
  });
});

describe("counts", () => {
  it("splits into followup / completed / rejected", () => {
    const counts = countAll([base, { ...base, pipeline_status: "Wrong Number" }, { ...base, pipeline_status: "Joined", actual_joining_date: "2026-10-01", source: "walkin" }].map((c) => categorize(c as Candidate)));
    expect(counts.in_followup).toBe(1);
    expect(counts.rejected).toBe(1);
    expect(counts.completed).toBe(1);
    expect(counts.walkin_joined_list).toBe(1);
  });
});

describe("salary and probation", () => {
  it("matches the original formula", () => {
    const s = calculateSalary(15000, 3000);
    expect(s).toMatchObject({ gross: 18000, esiEmployee: 113, pfEmployee: 1800, takeHome: 16087, esiEmployer: 488, pfEmployer: 1800, totalCtc: 20288 });
    expect(calculateSalary(30000, 0)).toMatchObject({ esiEmployee: 0, pfEmployee: 3000 });
  });
  it("probation end", () => {
    expect(probationEnd("2026-11-01")).toBe("2027-04-30");
    expect(probationEnd("2026-11-15")).toBe("2027-05-31");
    expect(probationEnd("2026-08-31")).toBe("2027-02-28");
  });
  it("treats form datetimes as IST", () => {
    expect(localInputToIso("2026-10-24T09:30")).toBe("2026-10-24T04:00:00.000Z");
  });
});
