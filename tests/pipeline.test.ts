import { describe, expect, it } from "vitest";
import { applyStage, isBlacklisted, needsReapplyReview, reactivate, stageFor, walkinBlocked } from "../lib/pipeline";
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
  employment_status: null, left_type: null, relieving_date: null, rejection_reason: null, interview_needed: null,
  source_channel: null, referred_by: null, talent_pool: false, talent_tags: [], offer_response: null, offer_responded_at: null,
  offer_decline_reason: null, confirmation_date: null, confirmation_approved_by: null, confirmation_approved_at: null, last_sms_key: null, last_sms_at: null, employee_code: null, shift_time: null,
  store_details_at: null, payroll_completed_at: null, payroll_completed_by: null, reapply_review: false, reapply_at: null,
  proposed_basic: null, proposed_allowances: null, salary_status: null, salary_approved_by: null, salary_approved_at: null, aadhaar_check: null,
  created_at: "", updated_at: "",
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

  it("schedules an interview at a chosen store and notifies the branch", () => {
    expect(applyStage(base, "initial", { callOutcome: "Contacted", callAction: "Interview Scheduled", interviewAt: "2026-10-25T10:30" }, now).error).toMatch(/location/);
    const r = applyStage(base, "initial", { callOutcome: "Contacted", callAction: "Interview Scheduled", interviewAt: "2026-10-25T10:30", interviewBranchId: "b2" }, now);
    expect(r.patch.pipeline_status).toBe("Interview Scheduled");
    expect(r.patch.interview_at).toBe("2026-10-25T05:00:00.000Z");
    expect(r.patch.branch_id).toBe("b2");
    expect(r.notify).toHaveLength(1);
  });

  it("blacklists Not Suitable / over-age (and old Age Criteria) for good", () => {
    for (const reason of ["Age Criteria", "Age - Over Age Limit", "Not Suitable"]) {
      const c = run(base, { callOutcome: "Contacted", callAction: "Rejected", rejectionReason: reason });
      expect(isBlacklisted(c)).toBe(true);
      expect(needsReapplyReview(c)).toBe(false);
      expect(reactivate(c).error).toBeDefined();
    }
  });

  it("sends underage rejections to the Re-Apply folder, not the blacklist", () => {
    const c = run(base, { callOutcome: "Contacted", callAction: "Rejected", rejectionReason: "Age - Underage" });
    expect(isBlacklisted(c)).toBe(false);
    expect(needsReapplyReview(c)).toBe(true);
    expect(walkinBlocked(c)).toBe(true);
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
    expect(categorize(joined).category).toBe("store_details_pending");
    expect(categorize({ ...joined, store_details_at: "2026-11-01T10:00:00Z" }).category).toBe("payroll_pending");
    expect(categorize({ ...joined, store_details_at: "2026-11-01T10:00:00Z", payroll_completed_at: "2026-11-02T10:00:00Z" }).category).toBe("online_joined_list");
    const left = run(joined, { employmentStatus: "Left", leftType: "Without Information", relievingDate: "2027-01-10" });
    expect(left.pipeline_status).toBe("Left (Without Information)");
    expect(left.relieving_date).toBe("2027-01-10");
    expect(isBlacklisted(left)).toBe(false);
    expect(needsReapplyReview(left)).toBe(true);
    expect(walkinBlocked(left)).toBe(true);
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
    const counts = countAll([base, { ...base, pipeline_status: "Wrong Number" }, { ...base, pipeline_status: "Joined", actual_joining_date: "2026-10-01", source: "walkin", payroll_completed_at: "2026-10-02T00:00:00Z" }].map((c) => categorize(c as Candidate)));
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
  it("matches the branches' printed confirmation letters", () => {
    // RADHA KANNAN M, Sivakasi, 25.10.2026
    expect(calculateSalary(10500, 2000)).toMatchObject({ gross: 12500, esiEmployee: 79, pfEmployee: 1260, takeHome: 11161, totalCtc: 14101 });
    expect(probationEnd("2026-03-01")).toBe("2026-08-31");
    // ABBAS M (the letter shows ESI 82 for 82.5 and take-home 12,098; CTC 15,178 matches)
    expect(calculateSalary(11000, 2500)).toMatchObject({ gross: 13500, pfEmployee: 1320, totalCtc: 15178 });
    expect(probationEnd("2020-09-08")).toBe("2021-03-31");
  });
  it("matches the branches' printed appointment letters", () => {
    // PRADEEPA, Akshaya Velli Tirunelveli (jewellery), and AYYANAR S, Balasanka TVS Sivakasi (automobiles)
    expect(calculateSalary(11500, 3500)).toMatchObject({ gross: 15000, esiEmployee: 86, pfEmployee: 1380, takeHome: 13534, totalCtc: 16754 });
    expect(probationEnd("2026-07-11")).toBe("2027-01-31");
    expect(calculateSalary(10000, 1000)).toMatchObject({ gross: 11000, esiEmployee: 75, pfEmployee: 1200, takeHome: 9725, totalCtc: 12525 });
    expect(probationEnd("2026-08-11")).toBe("2027-02-28");
  });
  it("treats form datetimes as IST", () => {
    expect(localInputToIso("2026-10-24T09:30")).toBe("2026-10-24T04:00:00.000Z");
  });
});
