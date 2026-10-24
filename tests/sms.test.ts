import { describe, expect, it } from "vitest";
import { smsItem, smsText } from "../lib/sms";
import { categorize, isTodaysWork } from "../lib/categorize";
import type { Candidate } from "../lib/types";

const now = new Date("2026-10-24T06:00:00Z"); // 24 Oct, 11:30 am IST
const c = (over: Partial<Candidate>) => ({
  name: "Priya", mobile: "9000000001", posts: ["Sales"], applied_locations: ["Tanishq - Theni"], branch_id: null, source: "online",
  pipeline_status: "Follow-up Not Started", rejection_reason: null, interview_at: null, next_action_at: null,
  expected_joining_date: null, revised_joining_date: null, last_sms_key: null, reapply_review: false, actual_joining_date: null, ...over,
}) as Candidate;
const item = (x: Candidate) => smsItem(x, categorize(x), now);

describe("Today's SMS list", () => {
  it("lists unreachable candidates until the message is sent", () => {
    const x = c({ pipeline_status: "First Retry Unreachable" });
    expect(item(x)?.kind).toBe("not_contactable");
    expect(item({ ...x, last_sms_key: "not_contactable:First Retry Unreachable" })).toBeNull();
    expect(item({ ...x, pipeline_status: "Second Retry Unreachable", last_sms_key: "not_contactable:First Retry Unreachable" })?.kind).toBe("not_contactable");
  });
  it("interview scheduled, then the day-before reminder", () => {
    const later = c({ pipeline_status: "Interview Scheduled", interview_at: "2026-10-28T05:00:00Z" });
    expect(item(later)?.kind).toBe("interview_scheduled");
    const tomorrow = c({ pipeline_status: "Interview Scheduled", interview_at: "2026-10-25T05:00:00Z", next_action_at: "2026-10-25T05:00:00Z" });
    expect(item(tomorrow)?.kind).toBe("interview_reminder");
    expect(isTodaysWork(tomorrow, categorize(tomorrow), now)).toBe(true);
    // after the reminder went out, the "scheduled" message isn't asked for again
    expect(item({ ...tomorrow, last_sms_key: "interview_reminder:2026-10-25T05:00:00Z" })).toBeNull();
  });
  it("joining tomorrow and not joined", () => {
    expect(item(c({ pipeline_status: "Expected Joining", expected_joining_date: "2026-10-25" }))?.kind).toBe("joining_reminder");
    expect(item(c({ pipeline_status: "Expected Joining", expected_joining_date: "2026-10-22" }))?.kind).toBe("not_joined");
    expect(item(c({ pipeline_status: "Expected Joining", expected_joining_date: "2026-10-30" }))).toBeNull();
  });
  it("missed interview, closed candidates", () => {
    expect(item(c({ pipeline_status: "Interview Scheduled - Unreachable", interview_at: "2026-10-23T05:00:00Z" }))?.kind).toBe("interview_missed");
    expect(item(c({ pipeline_status: "Not Contactable" }))).toBeNull();
  });
  it("uses the allocated HR's own number when the candidate is unreachable", () => {
    const ctx = { name: "Priya", post: "Sales", store: "Tanishq - Theni", address: "Theni", when: "25/10/2026", hrName: "Lithiga" };
    expect(smsText("not_contactable", { ...ctx, hrMobile: "9876543210" })).toContain("9876543210");
    expect(smsText("not_contactable", { ...ctx, hrMobile: null })).toContain("call us back on this number");
    expect(smsText("not_joined", { ...ctx, hrMobile: "9876543210", validity: "28/10/2026" })).toContain("valid only until 28/10/2026");
  });
});
