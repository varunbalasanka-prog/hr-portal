import { describe, expect, it } from "vitest";
import { JEWELLERY_FORM, cleanAnswers, cycleFor, formFor, interviewGaps, pastYears, risePct } from "../lib/appraisal";

describe("appraisal form", () => {
  it("uses April-to-March appraisal years", () => {
    expect(cycleFor("2026-10-27")).toBe("2026-27");
    expect(cycleFor("2027-03-31")).toBe("2026-27");
    expect(cycleFor("2027-04-01")).toBe("2027-28");
    expect(cycleFor("2099-05-01")).toBe("2099-00");
    expect(pastYears("2026-27")).toEqual(["2024-25", "2025-26"]);
  });

  it("keeps only known answers, with the right types", () => {
    const a = cleanAnswers(JEWELLERY_FORM, "2026-27", {
      "interview.presentation_done": true,
      "interview.expected_salary": "15000",
      "past.2025-26.late": "3",
      "past.2025-26.knowledge": "good",
      "past.2025-26.grooming": "excellent",  // not a grade
      "past.2019-20.late": "1",              // not a year on this cycle's form
      "next.total_sales": "abc",             // not a number
      "next.company_ideas": "  More tea breaks  ",
      "something.else": "x",
    });
    expect(a).toEqual({
      "interview.presentation_done": true, "interview.expected_salary": 15000,
      "past.2025-26.late": 3, "past.2025-26.knowledge": "good", "next.company_ideas": "More tea breaks",
    });
  });

  it("picks the form from the store's business type", () => {
    expect(formFor("Jewellery")?.kind).toBe("jewellery");
    expect(formFor("Automobiles")).toBeNull(); // until the automobile form is approved
  });

  it("needs the interview date, the 2-minute talk and both signatures before a proposal", () => {
    expect(interviewGaps({}, null)).toHaveLength(4);
    expect(interviewGaps({ "interview.presentation_done": true, "signoff.staff_signed": true, "signoff.incharge_signed": true }, "2026-10-27")).toEqual([]);
  });

  it("works out the rise in gross pay", () => {
    expect(risePct({ current_basic: 10000, current_allowances: 1000, proposed_basic: 11000, proposed_allowances: 1100 })).toBe(10);
    expect(risePct({ current_basic: null, current_allowances: null, proposed_basic: 11000, proposed_allowances: 0 })).toBeNull();
  });
});
