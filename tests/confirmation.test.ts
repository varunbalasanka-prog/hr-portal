import { describe, expect, it } from "vitest";
import { confirmationDate, confirmationState, letterDate } from "../lib/confirmation";
import { smsItem } from "../lib/sms";
import { categorize } from "../lib/categorize";
import type { Candidate } from "../lib/types";

const at = (day: string) => new Date(`${day}T06:00:00Z`); // 11:30 am IST
const emp = (over: Partial<Candidate> = {}) => ({
  name: "Radha", mobile: "9000000001", posts: ["Technician"], applied_locations: ["TVS - Sivakasi"], branch_id: null, source: "online",
  pipeline_status: "Joined", employment_status: "Working", actual_joining_date: "2026-03-01", confirmation_date: null,
  confirmation_approved_at: null, confirmation_approved_by: null, rejection_reason: null, interview_at: null, next_action_at: null,
  expected_joining_date: null, revised_joining_date: null, last_sms_key: null, reapply_review: false, ...over,
}) as Candidate;

describe("confirmation after probation", () => {
  it("is confirmed from the 1st after the 6-month probation", () => {
    expect(confirmationDate(emp())).toBe("2026-09-01");
    expect(confirmationDate(emp({ actual_joining_date: "2026-03-15" }))).toBe("2026-10-01");
  });
  it("asks HR to approve a week before the 1st", () => {
    expect(confirmationState(emp(), at("2026-08-24"))).toBe("upcoming");
    expect(confirmationState(emp(), at("2026-08-25"))).toBe("due");
    expect(confirmationState(emp(), at("2026-09-10"))).toBe("due");
  });
  it("skips probations that ended long before the portal did this, and people who left", () => {
    expect(confirmationState(emp({ actual_joining_date: "2020-09-08" }), at("2026-10-26"))).toBe("none");
    expect(confirmationState(emp({ employment_status: "Left" }), at("2026-08-26"))).toBe("none");
  });
  it("sends the approved letter from the SMS list on the 1st, once", () => {
    const approved = emp({ confirmation_approved_at: "2026-08-26T05:00:00Z", confirmation_date: "2026-09-01" });
    expect(confirmationState(approved, at("2026-08-31"))).toBe("approved");
    expect(smsItem(approved, categorize(approved), at("2026-08-31"))).toBeNull();
    expect(smsItem(approved, categorize(approved), at("2026-09-01"))?.kind).toBe("confirmation_letter");
    expect(smsItem({ ...approved, last_sms_key: "confirmation_letter:2026-09-01" }, categorize(approved), at("2026-09-02"))).toBeNull();
  });
  it("dates the letter the 1st, or the approval day if HR approved late", () => {
    expect(letterDate(emp({ confirmation_approved_at: "2026-08-26T05:00:00Z" }))).toBe("2026-09-01");
    expect(letterDate(emp({ confirmation_approved_at: "2026-10-25T05:00:00Z" }))).toBe("2026-10-25");
  });
});
