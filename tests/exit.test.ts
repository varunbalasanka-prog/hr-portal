import { describe, expect, it } from "vitest";
import { DEFAULT_EXIT_FORM, answerText, cleanExitAnswers, letterAllowed, missingAnswers, nextStep, openExit, sanitizeExitForm, type StaffExit } from "../lib/exit";
import { describeAction, targetTable } from "../lib/history-format";

const exit = (over: Partial<StaffExit> = {}): StaffExit => ({
  id: "x1", employment_id: "e1", status: "confirmed", kind: "resigned", reason_given: null, informed_on: null, last_day: "2026-11-30",
  raised_by: "store", raised_at: "2026-11-01T10:00:00Z", confirmed_by: "hr1", confirmed_at: "2026-11-02T10:00:00Z",
  interview_status: "pending", interview_on: null, relieved_by: null, relieved_at: null, cancelled_by: null, cancel_note: null, ...over,
});

describe("exit steps", () => {
  it("goes confirm → interview → wait → relieve → done", () => {
    expect(nextStep(exit({ status: "raised" }), "2026-11-10")).toBe("confirm");
    expect(nextStep(exit(), "2026-11-10")).toBe("interview");
    expect(nextStep(exit({ interview_status: "done" }), "2026-11-10")).toBe("wait");
    expect(nextStep(exit({ interview_status: "skipped" }), "2026-11-30")).toBe("relieve");
    expect(nextStep(exit({ status: "relieved", interview_status: "done" }), "2026-12-01")).toBe("done");
    expect(nextStep(exit({ status: "cancelled" }), "2026-12-01")).toBe("cancelled");
  });

  it("finds only the open exit of a stint", () => {
    const list = [exit({ id: "a", status: "cancelled" }), exit({ id: "b", status: "raised" }), exit({ id: "c", employment_id: "e2" })];
    expect(openExit(list, "e1")?.id).toBe("b");
    expect(openExit(list, "e3")).toBeNull();
    expect(openExit(null, "e1")).toBeNull();
  });

  it("gives a relieving letter only to people who resigned or retired, after the exit is closed", () => {
    expect(letterAllowed({ left_on: "2026-11-30", exit_type: "resigned" }, null)).toBe(true);
    expect(letterAllowed({ left_on: "2026-11-30", exit_type: "retired" }, null)).toBe(true);
    expect(letterAllowed({ left_on: "2026-11-30", exit_type: "absconded" }, null)).toBe(false);
    expect(letterAllowed({ left_on: "2026-11-30", exit_type: "terminated" }, null)).toBe(false);
    expect(letterAllowed({ left_on: null, exit_type: null }, null)).toBe(false);
    expect(letterAllowed({ left_on: "2026-11-30", exit_type: "resigned" }, exit())).toBe(false);
  });
});

describe("exit interview answers", () => {
  const form = DEFAULT_EXIT_FORM;

  it("keeps only answers that fit the questions", () => {
    const a = cleanExitAnswers(form, {
      main_reason: "Salary", other_reasons: ["Distance / travel", "Made up", "Distance / travel"], ratings: { Supervisor: 4, Team: 9, Salary: 2 },
      stay: "  More pay  ", recommend: "maybe", come_back: "sure", next: "Mars", unknown: "x",
    });
    expect(a).toEqual({ main_reason: "Salary", other_reasons: ["Distance / travel"], ratings: { Supervisor: 4, Salary: 2 }, stay: "More pay", recommend: "maybe" });
  });

  it("asks for the main reason", () => {
    expect(missingAnswers(form, {})).toEqual(["Main reason for leaving"]);
    expect(missingAnswers(form, { main_reason: "Family" })).toEqual([]);
  });

  it("reads answers back in plain words", () => {
    const q = (k: string) => form.questions.find((x) => x.key === k)!;
    expect(answerText(q("recommend"), "yes")).toBe("Yes");
    expect(answerText(q("other_reasons"), ["Salary", "Health"])).toBe("Salary, Health");
    expect(answerText(q("ratings"), { Team: 5 })).toBe("Team 5/5");
    expect(answerText(q("stay"), undefined)).toBe("-");
  });
});

describe("editing the questions", () => {
  it("keeps existing keys and makes keys for new questions", () => {
    const { form } = sanitizeExitForm({ version: "1", questions: [
      ...DEFAULT_EXIT_FORM.questions,
      { key: "", label: "Did you get your final salary?", type: "yesno" },
      { key: "", label: "Did you get your final salary?", type: "text" },
    ] }, "v2");
    expect(form?.version).toBe("v2");
    expect(form?.questions.slice(0, 7).map((q) => q.key)).toEqual(DEFAULT_EXIT_FORM.questions.map((q) => q.key));
    expect(form?.questions.slice(7).map((q) => q.key)).toEqual(["did_you_get_your_final_salary", "did_you_get_your_final_salary_2"]);
  });

  it("refuses empty wording, choices without options and an empty list", () => {
    expect(sanitizeExitForm({ version: "1", questions: [{ key: "", label: " ", type: "text" }] }, "v").error).toMatch(/English/);
    expect(sanitizeExitForm({ version: "1", questions: [{ key: "", label: "Pick", type: "choice", options: ["Only one", ""] }] }, "v").error).toMatch(/two choices/);
    expect(sanitizeExitForm({ version: "1", questions: [] }, "v").error).toMatch(/at least one/);
  });
});

describe("change history", () => {
  it("names exit actions and links them to the person", () => {
    expect(describeAction("relieve exit")).toBe("Relieved employee");
    expect(targetTable("relieve exit")).toBe("employments");
    expect(targetTable("save exit interview")).toBe("employments");
    expect(targetTable("approve appraisal")).toBe("appraisals");
  });
});
